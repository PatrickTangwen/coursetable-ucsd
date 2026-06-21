import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';

import { shouldExposeVerificationCode } from '../../api/src/auth/ucsdAuth.exposure.js';
import { appUserIdToLegacyNetId } from '../../api/src/auth/ucsdIdentity.js';

const execFileAsync = promisify(execFile);

const expectedTables = [
  'appUsers',
  'emailVerificationCodes',
  'savedSearches',
  'worksheets',
  'worksheetCourses',
];

const expectedIndexes = [
  'app_users_verified_email_unique_idx',
  'email_verification_email_idx',
  'email_verification_lookup_idx',
  'saved_searches_user_id_idx',
  'saved_searches_user_name_unique_idx',
  'worksheets_unique_idx',
  'worksheet_courses_unique_idx',
];

export interface RunConfig {
  apiOrigin: string;
  artifactDir: string;
  composeEnvFile: string;
  composeProject: string;
  email: string;
  keepData: boolean;
  rootDir: string;
  runId: string;
  savedSearchName: string;
}

interface ApiResponse {
  body: unknown;
  bodyText: string;
  headers: http.IncomingHttpHeaders;
  status: number;
}

interface CleanupState {
  keepData: boolean;
  succeeded: boolean;
}

interface EvidenceSummaryInput {
  apiOrigin: string;
  cleanup: {
    attempted: boolean;
    savedSearchRowsDeleted: number;
    verificationRowsDeleted: number;
  };
  email: string;
  http: { [key: string]: number };
  nonDevelopmentSafety: {
    productionExposesDevCode: boolean;
  };
  postgres: {
    expectedIndexesPresent: boolean;
    expectedTablesPresent: boolean;
    savedSearchDeleted: boolean;
    savedSearchOwnedByUserId: boolean;
    userRowFound: boolean;
    verificationRowConsumed: boolean;
    worksheetCourseRowsAfter: number;
    worksheetCourseRowsBefore: number;
    worksheetRowsAfter: number;
    worksheetRowsBefore: number;
  };
  redis: {
    sessionExistedAfterLogout: boolean;
    sessionExistedAfterVerify: boolean;
    sessionKeyFingerprint: string;
  };
  runId: string;
  savedSearchName: string;
  userId: number;
  verificationCodeSource: string;
}

class ApiClient {
  readonly #origin: URL;
  readonly cookies = new Map<string, string>();

  constructor(origin: string) {
    this.#origin = new URL(origin);
  }

  get(pathname: string) {
    return this.request('GET', pathname);
  }

  post(pathname: string, body?: unknown) {
    return this.request('POST', pathname, body);
  }

  async request(method: string, pathname: string, body?: unknown) {
    const target = new URL(pathname, this.#origin);
    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    const headers: { [key: string]: string } = {};
    const cookieHeader = formatCookieHeader(this.cookies);
    if (cookieHeader) headers.cookie = cookieHeader;
    if (bodyText !== undefined) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(bodyText));
    }

    const response = await requestRaw(target, {
      body: bodyText,
      headers,
      method,
    });
    parseSetCookieHeaders(response.headers['set-cookie'], this.cookies);
    return response;
  }
}

function requestRaw(
  target: URL,
  options: {
    body?: string;
    headers: { [key: string]: string };
    method: string;
  },
): Promise<ApiResponse> {
  const transport = target.protocol === 'https:' ? https : http;
  const requestOptions: https.RequestOptions = {
    headers: options.headers,
    hostname: target.hostname,
    method: options.method,
    path: `${target.pathname}${target.search}`,
    port: target.port,
    rejectUnauthorized: false,
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks: Uint8Array[] = [];
      res.on('data', (chunk: unknown) => {
        if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
        else if (chunk instanceof Uint8Array) chunks.push(chunk);
      });
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: unknown = text;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }
        resolve({
          body: parsed,
          bodyText: text,
          headers: res.headers,
          status: res.statusCode ?? 0,
        });
      });
    });
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

export function createRunConfig(
  argv = process.argv.slice(2),
  env: { [key: string]: string | undefined } = process.env,
  now = new Date(),
): RunConfig {
  const args = parseArgs(argv);
  const runId = formatRunId(now);
  const token = crypto
    .createHash('sha256')
    .update(`${runId}:${now.getTime()}`)
    .digest('hex')
    .slice(0, 8);
  const email = normalizeUcsdEmail(
    args.email ?? `auth-validation+${runId.toLowerCase()}-${token}@ucsd.edu`,
  );
  if (!email)
    throw new Error('Validation email must be a direct @ucsd.edu address');

  const apiPort = env.API_PORT ?? '3000';
  return {
    apiOrigin:
      args.apiOrigin ?? env.API_ORIGIN ?? `https://localhost:${apiPort}`,
    artifactDir:
      args.artifactDir ??
      path.join('artifacts/real-backend-auth-validation', runId),
    composeEnvFile:
      args.composeEnvFile ??
      env.COURSETABLE_AUTH_ENV_FILE ??
      'api/compose/local-validation.env.example',
    composeProject:
      args.composeProject ??
      env.COURSETABLE_AUTH_PROJECT ??
      'coursetable-auth-validation',
    email,
    keepData: args.keepData ?? false,
    rootDir: env.COURSETABLE_AUTH_REPO_ROOT ?? process.cwd(),
    runId,
    savedSearchName: args.savedSearchName ?? `Auth Validation ${runId}`,
  };
}

function parseArgs(argv: string[]) {
  const args: {
    apiOrigin?: string;
    artifactDir?: string;
    composeEnvFile?: string;
    composeProject?: string;
    email?: string;
    keepData?: boolean;
    savedSearchName?: string;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) throw new Error('Unexpected missing argument');
    switch (arg) {
      case '--api-origin':
        args.apiOrigin = readArgValue(argv, ++index, arg);
        break;
      case '--artifact-dir':
        args.artifactDir = readArgValue(argv, ++index, arg);
        break;
      case '--compose-env-file':
        args.composeEnvFile = readArgValue(argv, ++index, arg);
        break;
      case '--compose-project':
        args.composeProject = readArgValue(argv, ++index, arg);
        break;
      case '--email':
        args.email = readArgValue(argv, ++index, arg);
        break;
      case '--keep-data':
        args.keepData = true;
        break;
      case '--saved-search-name':
        args.savedSearchName = readArgValue(argv, ++index, arg);
        break;
      case '--help':
      case '-h':
        throw new Error(helpText());
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${helpText()}`);
    }
  }

  return args;
}

function readArgValue(argv: string[], index: number, name: string) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--'))
    throw new Error(`${name} requires a value`);

  return value;
}

function formatRunId(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z');
}

function normalizeUcsdEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain, ...rest] = normalized.split('@');
  if (!localPart || domain !== 'ucsd.edu' || rest.length > 0) return null;
  return normalized;
}

export function buildComposeArgs(config: RunConfig, command: string[]) {
  return [
    'compose',
    '--env-file',
    composeEnvFileForComposeDir(config),
    '-f',
    'docker-compose.yml',
    '-f',
    'dev-compose.yml',
    '-f',
    'local-validation-compose.yml',
    '-p',
    config.composeProject,
    ...command,
  ];
}

function composeDir(config: RunConfig) {
  return path.join(config.rootDir, 'api/compose');
}

function composeEnvFileForComposeDir(config: RunConfig) {
  if (path.isAbsolute(config.composeEnvFile)) return config.composeEnvFile;
  return path.relative(
    composeDir(config),
    path.resolve(config.rootDir, config.composeEnvFile),
  );
}

export function parseSetCookieHeaders(
  value: string[] | string | undefined,
  jar: Map<string, string>,
) {
  const cookies = Array.isArray(value) ? value : value ? [value] : [];
  for (const cookie of cookies) {
    const [pair = ''] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (!pair || separator === -1) continue;
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

export function formatCookieHeader(jar: Map<string, string>) {
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export function decodeConnectSessionId(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const decoded = decodeURIComponent(cookieValue);
  const signed = decoded.startsWith('s:') ? decoded.slice(2) : decoded;
  const [sessionId] = signed.split('.');
  return sessionId === undefined || sessionId === '' ? null : sessionId;
}

export function shouldCleanupMutableData(state: CleanupState) {
  return state.succeeded && !state.keepData;
}

export function buildEvidenceSummary(input: EvidenceSummaryInput) {
  return {
    ...input,
    result: 'passed',
    sensitiveValuesOmitted: [
      'verification code value',
      'connect.sid cookie value',
      'full Redis session key',
    ],
  };
}

export async function runValidation(config: RunConfig) {
  await mkdir(resolveRootPath(config, config.artifactDir), { recursive: true });

  const api = new ApiClient(config.apiOrigin);
  const httpEvidence: { [key: string]: number } = {};
  const rawArtifacts: { [key: string]: unknown } = {};
  let cleanup = {
    attempted: false,
    savedSearchRowsDeleted: 0,
    verificationRowsDeleted: 0,
  };
  let userId = 0;
  let savedSearchId = 0;
  let legacyNetId = '';

  try {
    await writeTextArtifact(
      config,
      'compose-ps.txt',
      await runCompose(config, ['ps']),
    );

    const ping = await api.get('/api/ping');
    expectStatus(ping, 200, 'GET /api/ping');
    if (ping.body !== 'pong')
      throw new Error('GET /api/ping did not return pong');
    httpEvidence.apiPingStatus = ping.status;

    const schemaEvidence = await collectSchemaEvidence(config);
    rawArtifacts.schemaEvidence = schemaEvidence;
    const expectedTablesPresent = allPresent(
      schemaEvidence.tables,
      expectedTables,
    );
    const expectedIndexesPresent = allPresent(
      schemaEvidence.indexes,
      expectedIndexes,
    );
    if (!expectedTablesPresent) {
      throw new Error(
        `Missing expected tables: ${missing(schemaEvidence.tables, expectedTables).join(', ')}`,
      );
    }
    if (!expectedIndexesPresent) {
      throw new Error(
        `Missing expected indexes: ${missing(schemaEvidence.indexes, expectedIndexes).join(', ')}`,
      );
    }

    const requestVerification = await api.post(
      '/api/auth/ucsd/request-verification',
      { email: config.email },
    );
    httpEvidence.requestVerificationStatus = requestVerification.status;
    expectStatus(
      requestVerification,
      200,
      'POST /api/auth/ucsd/request-verification',
    );
    const requestBody = expectRecord(requestVerification.body);
    const { devCode } = requestBody;
    if (typeof devCode !== 'string' || !/^\d{6}$/u.test(devCode)) {
      throw new Error(
        'Verification request did not expose a development devCode',
      );
    }

    const verify = await api.post('/api/auth/ucsd/verify', {
      code: devCode,
      email: config.email,
    });
    httpEvidence.verifyStatus = verify.status;
    expectStatus(verify, 200, 'POST /api/auth/ucsd/verify');
    const verifyBody = expectRecord(verify.body);
    const user = expectRecord(verifyBody.user);
    if (verifyBody.authenticated !== true)
      throw new Error('Verification response was not authenticated');
    if (typeof user.user_id !== 'number')
      throw new Error('Verification response did not include numeric user_id');
    if (user.verified_email !== config.email)
      throw new Error('Verification response returned the wrong email');
    userId = user.user_id;
    legacyNetId = appUserIdToLegacyNetId(userId);

    const sessionId = decodeConnectSessionId(api.cookies.get('connect.sid'));
    if (!sessionId) throw new Error('Verification did not set connect.sid');
    const redisAfterVerify = await redisSessionEvidence(config, sessionId);
    if (!redisAfterVerify.exists)
      throw new Error('Redis session key was not present after verification');

    const currentUser = await api.get('/api/auth/current-user');
    httpEvidence.currentUserStatus = currentUser.status;
    expectStatus(currentUser, 200, 'GET /api/auth/current-user');
    const currentUserBody = expectRecord(currentUser.body);
    if (currentUserBody.authenticated !== true)
      throw new Error('Current-user did not restore the verified session');

    const worksheetCountsBefore = await collectWorksheetCounts(
      config,
      legacyNetId,
    );
    if (
      worksheetCountsBefore.worksheets !== 0 ||
      worksheetCountsBefore.worksheetCourses !== 0
    ) {
      throw new Error(
        `Worksheet boundary failed before Saved Search flow for ${legacyNetId}`,
      );
    }

    const createSavedSearch = await api.post('/api/savedSearches/create', {
      name: config.savedSearchName,
      queryString: `?q=auth-validation-${config.runId.toLowerCase()}&subjects=CSE`,
    });
    httpEvidence.createSavedSearchStatus = createSavedSearch.status;
    expectStatus(createSavedSearch, 200, 'POST /api/savedSearches/create');
    const createdSavedSearch = expectRecord(createSavedSearch.body);
    if (typeof createdSavedSearch.id !== 'number')
      throw new Error('Saved Search create response did not include an id');
    savedSearchId = createdSavedSearch.id;

    const savedSearchRow = await collectSavedSearchRow(config, savedSearchId);
    rawArtifacts.savedSearchRow = savedSearchRow;
    if (!savedSearchRow)
      throw new Error('Saved Search row was not found in Postgres');
    if (savedSearchRow.userId !== userId)
      throw new Error('Saved Search row was not owned by internal user_id');
    if (savedSearchRow.netId !== legacyNetId) {
      throw new Error(
        'Saved Search legacy netId adapter did not match user_id',
      );
    }

    const listSavedSearches = await api.get('/api/savedSearches');
    httpEvidence.listSavedSearchesStatus = listSavedSearches.status;
    expectStatus(listSavedSearches, 200, 'GET /api/savedSearches');
    const listBody = expectRecord(listSavedSearches.body);
    const listedSearches = Array.isArray(listBody.data) ? listBody.data : [];
    if (!listedSearches.some((item) => expectRecord(item).id === savedSearchId))
      throw new Error('Saved Search list did not include the created search');

    const deleteSavedSearch = await api.post('/api/savedSearches/delete', {
      id: savedSearchId,
    });
    httpEvidence.deleteSavedSearchStatus = deleteSavedSearch.status;
    expectStatus(deleteSavedSearch, 200, 'POST /api/savedSearches/delete');
    const deletedSearchStillExists = await collectSavedSearchRow(
      config,
      savedSearchId,
    );
    if (deletedSearchStillExists)
      throw new Error('Saved Search row still existed after delete');

    const userRow = await collectAppUserRow(config, config.email);
    const verificationRow = await collectVerificationRow(config, config.email);
    rawArtifacts.userRow = userRow;
    rawArtifacts.verificationRow = verificationRow;
    if (!userRow) throw new Error('Created App User row was not found');
    if (!verificationRow?.consumed)
      throw new Error('Verification row was not marked consumed');

    const logout = await api.post('/api/auth/logout');
    httpEvidence.logoutStatus = logout.status;
    expectStatus(logout, 200, 'POST /api/auth/logout');
    const redisAfterLogout = await redisSessionEvidence(config, sessionId);
    if (redisAfterLogout.exists)
      throw new Error('Redis session key still existed after logout');

    const anonymousCurrentUser = await api.get('/api/auth/current-user');
    httpEvidence.anonymousCurrentUserStatus = anonymousCurrentUser.status;
    expectStatus(
      anonymousCurrentUser,
      200,
      'GET /api/auth/current-user after logout',
    );
    const anonymousBody = expectRecord(anonymousCurrentUser.body);
    if (anonymousBody.authenticated !== false || anonymousBody.user !== null)
      throw new Error('Current-user did not return anonymous after logout');

    const worksheetCountsAfter = await collectWorksheetCounts(
      config,
      legacyNetId,
    );
    if (
      worksheetCountsAfter.worksheets !== 0 ||
      worksheetCountsAfter.worksheetCourses !== 0
    ) {
      throw new Error(
        `Worksheet boundary failed after auth flow for ${legacyNetId}`,
      );
    }

    const nonDevelopmentSafety = assertNonDevelopmentSafety();
    if (nonDevelopmentSafety.productionExposesDevCode)
      throw new Error('Production-like auth route exposed devCode');

    if (
      shouldCleanupMutableData({ succeeded: true, keepData: config.keepData })
    ) {
      cleanup = await cleanupMutableData(
        config,
        config.email,
        config.savedSearchName,
      );
    }

    const summary = buildEvidenceSummary({
      apiOrigin: config.apiOrigin,
      cleanup,
      email: config.email,
      http: httpEvidence,
      nonDevelopmentSafety,
      postgres: {
        expectedIndexesPresent,
        expectedTablesPresent,
        savedSearchDeleted: true,
        savedSearchOwnedByUserId: true,
        userRowFound: Boolean(userRow),
        verificationRowConsumed: Boolean(verificationRow.consumed),
        worksheetCourseRowsAfter: worksheetCountsAfter.worksheetCourses,
        worksheetCourseRowsBefore: worksheetCountsBefore.worksheetCourses,
        worksheetRowsAfter: worksheetCountsAfter.worksheets,
        worksheetRowsBefore: worksheetCountsBefore.worksheets,
      },
      redis: {
        sessionExistedAfterLogout: redisAfterLogout.exists,
        sessionExistedAfterVerify: redisAfterVerify.exists,
        sessionKeyFingerprint: fingerprint(sessionId),
      },
      runId: config.runId,
      savedSearchName: config.savedSearchName,
      userId,
      verificationCodeSource: 'development-only devCode response field',
    });

    await writeJsonArtifact(config, 'summary.json', summary);
    await writeTextArtifact(config, 'summary.md', renderSummary(summary));
    await writeJsonArtifact(config, 'postgres-evidence.json', {
      schemaEvidence,
      savedSearchRow,
      userRow,
      verificationRow,
      worksheetCountsAfter,
      worksheetCountsBefore,
    });
    await writeJsonArtifact(config, 'http-evidence.json', httpEvidence);
    await writeJsonArtifact(config, 'redis-evidence.json', summary.redis);

    return summary;
  } catch (error) {
    await writeJsonArtifact(config, 'failure.json', {
      cleanupAttempted: false,
      error: error instanceof Error ? error.message : String(error),
      failedStatePreserved: true,
      http: httpEvidence,
      rawArtifacts,
      savedSearchId,
      userId,
      legacyNetId,
    });
    throw error;
  }
}

async function runCompose(config: RunConfig, command: string[]) {
  const { stderr, stdout } = await execFileAsync(
    'docker',
    buildComposeArgs(config, command),
    {
      cwd: composeDir(config),
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  return `${stdout}${stderr ? `\n${stderr}` : ''}`;
}

async function queryPostgresJson(config: RunConfig, sql: string) {
  const env = await readValidationEnv(config);
  const output = await runCompose(config, [
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    env.DB_USER ?? 'postgres',
    '-d',
    env.DB_NAME ?? 'coursetable_data',
    '-v',
    'ON_ERROR_STOP=1',
    '-X',
    '-q',
    '-t',
    '-A',
    '-c',
    sql,
  ]);
  const trimmed = output.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as unknown;
}

async function collectSchemaEvidence(config: RunConfig) {
  const result = expectRecord(
    await queryPostgresJson(
      config,
      `
select json_build_object(
  'tables',
  coalesce((
    select json_agg(tablename order by tablename)
    from pg_tables
    where schemaname = 'public'
      and tablename in (${sqlList(expectedTables)})
  ), '[]'::json),
  'indexes',
  coalesce((
    select json_agg(indexname order by indexname)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (${sqlList(expectedIndexes)})
  ), '[]'::json)
);
      `,
    ),
  );

  return {
    indexes: toStringArray(result.indexes),
    tables: toStringArray(result.tables),
  };
}

async function collectAppUserRow(config: RunConfig, email: string) {
  return (await queryPostgresJson(
    config,
    `
select coalesce((
  select row_to_json(row)
  from (
    select id, "verifiedEmail", "createdAt", "updatedAt"
    from "appUsers"
    where "verifiedEmail" = ${sqlString(email)}
    limit 1
  ) row
), 'null'::json);
    `,
  )) as null | {
    createdAt: number;
    id: number;
    updatedAt: number;
    verifiedEmail: string;
  };
}

async function collectVerificationRow(config: RunConfig, email: string) {
  return (await queryPostgresJson(
    config,
    `
select coalesce((
  select row_to_json(row)
  from (
    select id, "normalizedEmail", ("consumedAt" is not null) as consumed
    from "emailVerificationCodes"
    where "normalizedEmail" = ${sqlString(email)}
    order by id desc
    limit 1
  ) row
), 'null'::json);
    `,
  )) as null | {
    consumed: boolean;
    id: number;
    normalizedEmail: string;
  };
}

async function collectSavedSearchRow(config: RunConfig, id: number) {
  return (await queryPostgresJson(
    config,
    `
select coalesce((
  select row_to_json(row)
  from (
    select id, "userId", "netId", name, "queryString", "createdAt"
    from "savedSearches"
    where id = ${id}
    limit 1
  ) row
), 'null'::json);
    `,
  )) as null | {
    createdAt: number;
    id: number;
    name: string;
    netId: string;
    queryString: string;
    userId: number;
  };
}

async function collectWorksheetCounts(config: RunConfig, netId: string) {
  return expectWorksheetCounts(
    await queryPostgresJson(
      config,
      `
select json_build_object(
  'worksheets',
  (select count(*)::int from "worksheets" where "netId" = ${sqlString(netId)}),
  'worksheetCourses',
  (
    select count(*)::int
    from "worksheetCourses" wc
    inner join "worksheets" w on w.id = wc."worksheetId"
    where w."netId" = ${sqlString(netId)}
  )
);
      `,
    ),
  );
}

async function cleanupMutableData(
  config: RunConfig,
  email: string,
  savedSearchName: string,
) {
  const result = expectRecord(
    await queryPostgresJson(
      config,
      `
with deleted_verifications as (
  delete from "emailVerificationCodes"
  where "normalizedEmail" = ${sqlString(email)}
  returning id
), deleted_saved_searches as (
  delete from "savedSearches"
  where name = ${sqlString(savedSearchName)}
  returning id
)
select json_build_object(
  'verificationRowsDeleted',
  (select count(*)::int from deleted_verifications),
  'savedSearchRowsDeleted',
  (select count(*)::int from deleted_saved_searches)
);
      `,
    ),
  );

  return {
    attempted: true,
    savedSearchRowsDeleted: numberValue(result.savedSearchRowsDeleted),
    verificationRowsDeleted: numberValue(result.verificationRowsDeleted),
  };
}

async function redisSessionEvidence(config: RunConfig, sessionId: string) {
  const key = `myapp:${sessionId}`;
  const output = await runCompose(config, [
    'exec',
    '-T',
    'redis',
    'redis-cli',
    'EXISTS',
    key,
  ]);
  return {
    exists: output.trim() === '1',
    sessionKeyFingerprint: fingerprint(key),
  };
}

function assertNonDevelopmentSafety() {
  return {
    productionExposesDevCode: shouldExposeVerificationCode('production'),
  };
}

async function readValidationEnv(config: RunConfig) {
  const envPath = resolveRootPath(config, config.composeEnvFile);
  const file = await readFile(envPath, 'utf8');
  return Object.fromEntries(
    file
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator === -1) return [line, ''];
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function resolveRootPath(config: RunConfig, pathname: string) {
  if (path.isAbsolute(pathname)) return pathname;
  return path.join(config.rootDir, pathname);
}

function expectStatus(response: ApiResponse, status: number, label: string) {
  if (response.status !== status) {
    throw new Error(
      `${label} returned HTTP ${response.status}: ${response.bodyText}`,
    );
  }
}

function expectRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Expected object, got ${JSON.stringify(value)}`);
  return value as { [key: string]: unknown };
}

function expectWorksheetCounts(value: unknown) {
  const record = expectRecord(value);
  return {
    worksheetCourses: numberValue(record.worksheetCourses),
    worksheets: numberValue(record.worksheets),
  };
}

function numberValue(value: unknown) {
  if (typeof value !== 'number')
    throw new Error(`Expected number: ${String(value)}`);
  return value;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function allPresent(actual: string[], expected: string[]) {
  return missing(actual, expected).length === 0;
}

function missing(actual: string[], expected: string[]) {
  const actualSet = new Set(actual);
  return expected.filter((item) => !actualSet.has(item));
}

function sqlList(values: string[]) {
  return values.map(sqlString).join(', ');
}

function sqlString(value: string) {
  return `'${value.replace(/'/gu, "''")}'`;
}

function fingerprint(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function writeJsonArtifact(
  config: RunConfig,
  name: string,
  value: unknown,
) {
  await writeTextArtifact(config, name, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextArtifact(
  config: RunConfig,
  name: string,
  value: string,
) {
  await writeFile(
    path.join(resolveRootPath(config, config.artifactDir), name),
    value,
  );
}

function renderSummary(summary: ReturnType<typeof buildEvidenceSummary>) {
  return `# Real Backend Auth Validation Evidence

- Result: ${summary.result}
- Run ID: ${summary.runId}
- API origin: ${summary.apiOrigin}
- Test email: ${summary.email}
- App User ID: ${summary.userId}
- Verification code source: ${summary.verificationCodeSource}
- Saved Search name: ${summary.savedSearchName}
- Postgres tables/indexes present: ${String(summary.postgres.expectedTablesPresent)}/${String(summary.postgres.expectedIndexesPresent)}
- Saved Search owned by internal user_id: ${String(summary.postgres.savedSearchOwnedByUserId)}
- Verification row consumed: ${String(summary.postgres.verificationRowConsumed)}
- Worksheet rows before/after: ${summary.postgres.worksheetRowsBefore}/${summary.postgres.worksheetRowsAfter}
- Worksheet course rows before/after: ${summary.postgres.worksheetCourseRowsBefore}/${summary.postgres.worksheetCourseRowsAfter}
- Redis session existed after verify/logout: ${String(summary.redis.sessionExistedAfterVerify)}/${String(summary.redis.sessionExistedAfterLogout)}
- Non-development devCode exposed: ${String(summary.nonDevelopmentSafety.productionExposesDevCode)}
- Cleanup attempted: ${String(summary.cleanup.attempted)}

Sensitive values intentionally omitted: ${summary.sensitiveValuesOmitted.join(', ')}.
`;
}

function helpText() {
  return `Usage: bun tools/real-backend-auth-validation/validateRealBackendAuth.mts [options]

Options:
  --api-origin <url>          Host API origin, default https://localhost:$API_PORT or https://localhost:3000
  --artifact-dir <path>       Evidence output directory
  --compose-env-file <path>   Compose env file, default api/compose/local-validation.env.example
  --compose-project <name>    Compose project, default coursetable-auth-validation
  --email <email>             Unique @ucsd.edu test email
  --saved-search-name <name>  Unique Saved Search name
  --keep-data                 Keep cleanup-eligible successful-run rows
`;
}

if (import.meta.main) {
  let config: RunConfig | null = null;
  try {
    config = createRunConfig();
    const summary = await runValidation(config);
    console.log(renderSummary(summary));
    console.log(`Evidence written to ${config.artifactDir}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (config)
      console.error(`Failure evidence written to ${config.artifactDir}`);

    process.exitCode = message.startsWith('Usage:') ? 0 : 1;
  }
}
