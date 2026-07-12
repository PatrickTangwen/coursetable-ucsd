import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';

import { shouldExposeVerificationCode } from '../../api/src/auth/ucsdAuth.exposure.js';
import { appUserIdToLegacyNetId } from '../../api/src/auth/ucsdIdentity.js';
import {
  captureFilename,
  hostedValidationCaptureDirectory,
} from '../../api/src/auth/verificationEmail.capture.js';
import {
  assertGeneralTelemetrySafe,
  createRecipientTelemetryReference,
} from '../../api/src/telemetry/privacy.js';

const execFileAsync = promisify(execFile);

const expectedTables = [
  'appUsers',
  'emailDeliveryAudits',
  'emailVerificationCodes',
  'savedSearches',
  'worksheets',
  'worksheetCourses',
];

const expectedIndexes = [
  'app_users_verified_email_unique_idx',
  'email_delivery_audit_expiry_idx',
  'email_delivery_audit_recipient_time_idx',
  'email_verification_email_idx',
  'email_verification_lookup_idx',
  'saved_searches_user_id_idx',
  'saved_searches_user_name_unique_idx',
  'worksheets_unique_idx',
  'worksheet_courses_unique_idx',
];
const expectedConstraints = [
  'savedSearches_userId_appUsers_id_fk',
  'savedWorksheets_userId_appUsers_id_fk',
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
  recipient: {
    maskedEmail: string;
    recipientRef: string;
  };
  http: { [key: string]: number };
  nonDevelopmentSafety: {
    productionExposesDevCode: boolean;
  };
  postgres: {
    expectedIndexesPresent: boolean;
    expectedOwnershipConstraintsPresent: boolean;
    expectedTablesPresent: boolean;
    savedSearchDeleted: boolean;
    savedSearchOwnedByUserId: boolean;
    accountOwnedDataIsolated: boolean;
    existingAppUserRestored: boolean;
    savedWorksheetIsolated: boolean;
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
  appUserIdFingerprint: string;
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
    if (this.#origin.protocol === 'http:')
      headers['x-forwarded-proto'] = 'https';
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
      args.apiOrigin ?? env.API_ORIGIN ?? `http://localhost:${apiPort}`,
    artifactDir:
      args.artifactDir ??
      path.join('artifacts/real-backend-auth-validation', runId),
    composeEnvFile:
      args.composeEnvFile ??
      env.COURSETABLE_AUTH_ENV_FILE ??
      'api/compose/core-validation.env.example',
    composeProject:
      args.composeProject ??
      env.COURSETABLE_AUTH_PROJECT ??
      `coursetable-auth-validation-${runId.toLowerCase()}`,
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
    'core-validation-compose.yml',
    '-p',
    config.composeProject,
    ...command,
  ];
}

export function inspectComposeProject(output: string) {
  const trimmed = output.trim();
  if (!trimmed || trimmed === '[]')
    return { available: true, resourceCount: 0 };
  const parsed = JSON.parse(trimmed) as unknown;
  const resources = Array.isArray(parsed) ? parsed : [parsed];
  if (resources.length > 0) {
    throw new Error(
      `Compose project already owns resources (${resources.length}); choose a unique project name`,
    );
  }
  return { available: true, resourceCount: 0 };
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
  const summary = {
    ...input,
    result: 'passed',
    sensitiveValuesOmitted: [
      'verification code value',
      'connect.sid cookie value',
      'full Redis session key',
      'API keys',
      'raw database rows and identifiers',
    ],
  };
  assertGeneralTelemetrySafe(summary);
  return summary;
}

export async function runValidation(config: RunConfig) {
  await mkdir(resolveRootPath(config, config.artifactDir), { recursive: true });

  const api = new ApiClient(config.apiOrigin);
  const httpEvidence: { [key: string]: number } = {};
  let cleanup = {
    attempted: false,
    savedSearchRowsDeleted: 0,
    verificationRowsDeleted: 0,
  };
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

    const metadata = await api.get('/api/catalog/metadata');
    expectStatus(metadata, 200, 'GET /api/catalog/metadata');
    httpEvidence.catalogMetadataStatus = metadata.status;
    const publishedSnapshot = await api.get('/api/catalog/public/SP26');
    expectStatus(publishedSnapshot, 200, 'GET /api/catalog/public/SP26');
    httpEvidence.catalogSnapshotStatus = publishedSnapshot.status;

    for (const pathname of [
      '/ferry/v1/graphql',
      '/api/auth/cas',
      '/api/canny/token',
      '/api/challenge/request',
      '/api/catalog/csv/202601.csv',
      '/api/catalog/evals/202601',
      '/api/friends/names',
      '/api/demand/worksheet',
      '/api/link-preview',
      '/api/profile/me',
      '/api/profile/search',
      '/api/sitemaps/index.xml',
      '/api/user/wishlist',
      '/api/catalog/refresh',
    ]) {
      const disabledRoute = await api.get(pathname);
      expectStatus(disabledRoute, 404, `GET ${pathname}`);
    }
    httpEvidence.disabledLegacyRoutesStatus = 404;

    const schemaEvidence = await collectSchemaEvidence(config);
    const expectedTablesPresent = allPresent(
      schemaEvidence.tables,
      expectedTables,
    );
    const expectedIndexesPresent = allPresent(
      schemaEvidence.indexes,
      expectedIndexes,
    );
    const expectedOwnershipConstraintsPresent = allPresent(
      schemaEvidence.constraints,
      expectedConstraints,
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
    if (!expectedOwnershipConstraintsPresent) {
      throw new Error('Missing App User ownership constraints');
    }

    const verify = await requestAndVerify(config, api, config.email);
    httpEvidence.requestVerificationStatus = 200;
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
    const userId = user.user_id;
    const legacyNetId = appUserIdToLegacyNetId(userId);

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
    const restoredUser = expectRecord(currentUserBody.user);
    if (restoredUser.user_id !== userId)
      throw new Error('Current-user restored a different App User ID');

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
    const savedSearchId = createdSavedSearch.id;

    const savedSearchRow = await collectSavedSearchRow(config, savedSearchId);
    if (!savedSearchRow)
      throw new Error('Saved Search row was not found in Postgres');
    if (savedSearchRow.userId !== userId)
      throw new Error('Saved Search row was not owned by internal user_id');
    if (savedSearchRow.netId !== legacyNetId) {
      throw new Error(
        'Saved Search legacy netId adapter did not match user_id',
      );
    }

    const createSavedWorksheet = await api.post(
      '/api/savedWorksheets/from-anonymous',
      {
        name: `Hosted validation ${config.runId}`,
        term: 'FA26',
        courses: [
          {
            sectionId: 'hosted-validation-section',
            color: '#123456',
            hidden: false,
          },
        ],
      },
    );
    httpEvidence.createSavedWorksheetStatus = createSavedWorksheet.status;
    expectStatus(
      createSavedWorksheet,
      200,
      'POST /api/savedWorksheets/from-anonymous',
    );
    const savedWorksheetId = expectNumericId(createSavedWorksheet.body);

    const boundaryEmail = `auth-boundary+${config.runId.toLowerCase()}@ucsd.edu`;
    const boundaryApi = new ApiClient(config.apiOrigin);
    const boundaryVerify = await requestAndVerify(
      config,
      boundaryApi,
      boundaryEmail,
    );
    httpEvidence.boundaryRequestVerificationStatus = 200;
    httpEvidence.boundaryVerifyStatus = boundaryVerify.status;
    const boundaryUser = expectRecord(expectRecord(boundaryVerify.body).user);
    if (
      typeof boundaryUser.user_id !== 'number' ||
      boundaryUser.user_id === userId
    ) {
      throw new Error(
        'Boundary account did not receive a distinct App User ID',
      );
    }

    const boundaryList = await boundaryApi.get('/api/savedSearches');
    httpEvidence.boundaryListSavedSearchesStatus = boundaryList.status;
    expectStatus(boundaryList, 200, 'GET /api/savedSearches as other account');
    const boundaryListBody = expectRecord(boundaryList.body);
    const boundarySearches = Array.isArray(boundaryListBody.data)
      ? boundaryListBody.data
      : [];
    if (
      boundarySearches.some((item) => expectRecord(item).id === savedSearchId)
    ) {
      throw new Error('Another App User could list account-owned data');
    }

    const boundaryDelete = await boundaryApi.post('/api/savedSearches/delete', {
      id: savedSearchId,
    });
    httpEvidence.boundaryDeleteSavedSearchStatus = boundaryDelete.status;
    expectStatus(
      boundaryDelete,
      404,
      'POST /api/savedSearches/delete as other account',
    );
    if (!(await collectSavedSearchRow(config, savedSearchId)))
      throw new Error('Another App User deleted account-owned data');

    const boundaryWorksheetRead = await boundaryApi.get(
      `/api/savedWorksheets/${savedWorksheetId}`,
    );
    httpEvidence.boundaryWorksheetReadStatus = boundaryWorksheetRead.status;
    expectStatus(
      boundaryWorksheetRead,
      404,
      'GET /api/savedWorksheets/:id as other account',
    );
    const boundaryWorksheetRename = await boundaryApi.post(
      `/api/savedWorksheets/${savedWorksheetId}/rename`,
      { name: 'unauthorized rename' },
    );
    httpEvidence.boundaryWorksheetRenameStatus = boundaryWorksheetRename.status;
    expectStatus(
      boundaryWorksheetRename,
      404,
      'POST /api/savedWorksheets/:id/rename as other account',
    );
    const ownerWorksheetRead = await api.get(
      `/api/savedWorksheets/${savedWorksheetId}`,
    );
    httpEvidence.ownerWorksheetReadStatus = ownerWorksheetRead.status;
    expectStatus(
      ownerWorksheetRead,
      200,
      'GET /api/savedWorksheets/:id as owner',
    );
    const ownerWorksheet = expectRecord(ownerWorksheetRead.body);
    if (ownerWorksheet.name !== `Hosted validation ${config.runId}`)
      throw new Error('Another App User mutated the Saved Worksheet');

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

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1_100);
    });
    const restoredApi = new ApiClient(config.apiOrigin);
    const restoredVerify = await requestAndVerify(
      config,
      restoredApi,
      config.email,
    );
    httpEvidence.restoredVerifyStatus = restoredVerify.status;
    expectStatus(
      restoredVerify,
      200,
      'POST /api/auth/ucsd/verify for re-login',
    );
    const restoredLoginUser = expectRecord(
      expectRecord(restoredVerify.body).user,
    );
    if (restoredLoginUser.user_id !== userId)
      throw new Error('Re-login created a different App User');
    if ((await countAppUsers(config, config.email)) !== 1)
      throw new Error('Re-login duplicated the App User');
    const restoredLogout = await restoredApi.post('/api/auth/logout');
    httpEvidence.restoredLogoutStatus = restoredLogout.status;
    expectStatus(restoredLogout, 200, 'POST /api/auth/logout after re-login');

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
      await cleanupVerificationRows(config, boundaryEmail);
    }

    const validationEnvironment = await readValidationEnv(config);
    const telemetryHmacKey = validationEnvironment.TELEMETRY_HMAC_KEY;
    if (!telemetryHmacKey)
      throw new Error('Validation environment missing TELEMETRY_HMAC_KEY');
    const summary = buildEvidenceSummary({
      apiOrigin: config.apiOrigin,
      cleanup,
      recipient: createRecipientTelemetryReference(
        config.email,
        telemetryHmacKey,
      ),
      http: httpEvidence,
      nonDevelopmentSafety,
      postgres: {
        accountOwnedDataIsolated: true,
        existingAppUserRestored: true,
        expectedIndexesPresent,
        expectedOwnershipConstraintsPresent,
        expectedTablesPresent,
        savedSearchDeleted: true,
        savedSearchOwnedByUserId: true,
        savedWorksheetIsolated: true,
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
      appUserIdFingerprint: fingerprint(String(userId)),
      verificationCodeSource: 'explicit hosted-validation capture sender',
    });

    await writeJsonArtifact(config, 'summary.json', summary);
    await writeTextArtifact(config, 'summary.md', renderSummary(summary));
    await writeJsonArtifact(config, 'postgres-evidence.json', summary.postgres);
    await writeJsonArtifact(config, 'http-evidence.json', httpEvidence);
    await writeJsonArtifact(config, 'redis-evidence.json', summary.redis);

    return summary;
  } catch (error) {
    await writeJsonArtifact(config, 'failure.json', {
      failureCategory: categorizeFailure(error),
      http: httpEvidence,
      sensitiveCleanupRequired: true,
      sensitiveValuesOmitted: true,
    });
    throw error;
  } finally {
    await cleanupCapturedFiles(config);
  }
}

async function requestAndVerify(
  config: RunConfig,
  api: ApiClient,
  email: string,
) {
  const requestVerification = await api.post(
    '/api/auth/ucsd/request-verification',
    { email },
  );
  expectStatus(
    requestVerification,
    200,
    'POST /api/auth/ucsd/request-verification',
  );
  const requestBody = expectRecord(requestVerification.body);
  if (Object.hasOwn(requestBody, 'devCode')) {
    throw new Error('Hosted-like verification response exposed devCode');
  }

  if (requestBody.status !== 'verification_sent') {
    throw new Error('Verification request did not confirm sender delivery');
  }

  const code = await consumeCapturedVerification(config, email);
  return api.post('/api/auth/ucsd/verify', { code, email });
}

async function consumeCapturedVerification(config: RunConfig, email: string) {
  const filename = path.posix.join(
    hostedValidationCaptureDirectory,
    captureFilename(email),
  );
  const output = await runCompose(config, [
    'exec',
    '-T',
    'api',
    'cat',
    filename,
  ]).finally(async () => {
    await runCompose(config, ['exec', '-T', 'api', 'rm', '-f', filename]);
  });
  const captured = expectRecord(JSON.parse(output.trim()) as unknown);
  if (captured.recipient !== email || typeof captured.deliveryId !== 'string')
    throw new Error('Capture sender returned a mismatched delivery');
  if (typeof captured.code !== 'string' || !/^\d{6}$/u.test(captured.code))
    throw new Error('Capture sender did not provide a verification code');
  return captured.code;
}

export async function runCompose(config: RunConfig, command: string[]) {
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
  ), '[]'::json),
  'constraints',
  coalesce((
    select json_agg(conname order by conname)
    from pg_constraint
    where conname in (${sqlList(expectedConstraints)})
  ), '[]'::json)
);
      `,
    ),
  );

  return {
    constraints: toStringArray(result.constraints),
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

async function countAppUsers(config: RunConfig, email: string) {
  const result = expectRecord(
    await queryPostgresJson(
      config,
      `select json_build_object('count', count(*)::int)
       from "appUsers" where "verifiedEmail" = ${sqlString(email)};`,
    ),
  );
  return numberValue(result.count);
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
), validation_users as (
  select id from "appUsers" where "verifiedEmail" = ${sqlString(email)}
), deleted_saved_worksheet_sections as (
  delete from "savedWorksheetSections"
  where "worksheetId" in (
    select id from "savedWorksheets"
    where "userId" in (select id from validation_users)
  )
  returning id
), deleted_saved_worksheets as (
  delete from "savedWorksheets"
  where "userId" in (select id from validation_users)
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

async function cleanupVerificationRows(config: RunConfig, email: string) {
  await queryPostgresJson(
    config,
    `
with deleted as (
  delete from "emailVerificationCodes"
  where "normalizedEmail" = ${sqlString(email)}
  returning id
)
select json_build_object('deleted', count(*)::int) from deleted;
    `,
  );
}

async function cleanupCapturedFiles(config: RunConfig) {
  await runCompose(config, [
    'exec',
    '-T',
    'api',
    'rm',
    '-rf',
    hostedValidationCaptureDirectory,
  ]).catch(() => {
    throw new Error('Sensitive capture cleanup failed');
  });
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
    throw new Error(`${label} returned unexpected HTTP status`);
  }
}

function expectRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected response object');
  return value as { [key: string]: unknown };
}

function expectNumericId(value: unknown) {
  const record = expectRecord(value);
  if (typeof record.id !== 'number')
    throw new Error('Response did not include a numeric identifier');
  return record.id;
}

function categorizeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('cleanup')) return 'sensitive_cleanup_failed';
  if (message.includes('HTTP status')) return 'unexpected_http_status';
  if (message.includes('capture')) return 'capture_sender_failed';
  if (message.includes('Redis')) return 'session_validation_failed';
  if (message.includes('App User')) return 'app_user_validation_failed';
  if (message.includes('Worksheet')) return 'worksheet_boundary_failed';
  return 'hosted_auth_validation_failed';
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
  assertGeneralTelemetrySafe(value);
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
- Test recipient: ${summary.recipient.maskedEmail} (${summary.recipient.recipientRef})
- App User ID fingerprint: ${summary.appUserIdFingerprint}
- Verification code source: ${summary.verificationCodeSource}
- Saved Search name: ${summary.savedSearchName}
- Postgres tables/indexes present: ${String(summary.postgres.expectedTablesPresent)}/${String(summary.postgres.expectedIndexesPresent)}
- App User ownership constraints present: ${String(summary.postgres.expectedOwnershipConstraintsPresent)}
- Saved Search owned by internal user_id: ${String(summary.postgres.savedSearchOwnedByUserId)}
- Account-owned data isolated from another App User: ${String(summary.postgres.accountOwnedDataIsolated)}
- Saved Worksheet isolated from another App User: ${String(summary.postgres.savedWorksheetIsolated)}
- Existing App User restored without duplicate: ${String(summary.postgres.existingAppUserRestored)}
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
  --api-origin <url>          Host API origin, default http://localhost:$API_PORT or http://localhost:3000
  --artifact-dir <path>       Evidence output directory
  --compose-env-file <path>   Compose env file, default api/compose/core-validation.env.example
  --compose-project <name>    Compose project, default coursetable-auth-validation
  --email <email>             Unique @ucsd.edu test email
  --saved-search-name <name>  Unique Saved Search name
  --keep-data                 Keep cleanup-eligible successful-run rows
`;
}

if (import.meta.main) {
  let config: RunConfig | null = null;
  let ownsComposeProject = false;
  try {
    config = createRunConfig();
    inspectComposeProject(
      await runCompose(config, ['ps', '-a', '--format', 'json']),
    );
    ownsComposeProject = true;
    await runCompose(config, [
      'up',
      '-d',
      '--build',
      '--wait',
      '--remove-orphans',
    ]);
    await runCompose(config, ['exec', '-T', 'api', 'bun', 'run', 'db:migrate']);
    const summary = await runValidation(config);
    console.log(renderSummary(summary));
    console.log(`Evidence written to ${config.artifactDir}`);
  } catch (error: unknown) {
    console.error(`Validation failed: ${categorizeFailure(error)}`);
    if (config)
      console.error(`Failure evidence written to ${config.artifactDir}`);

    process.exitCode = 1;
  } finally {
    if (config && ownsComposeProject) {
      await runCompose(config, ['down', '--volumes', '--remove-orphans']).catch(
        () => {
          console.error('Validation stack teardown failed');
          process.exitCode = 1;
        },
      );
    }
  }
}
