import { randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { chromium, type Page } from 'playwright';
import { z } from 'zod';

import { loadCatalogSnapshotConfig } from './catalogSnapshot.js';
import {
  assertApprovedTssResponseUrl,
  buildTssODataRequests,
  sanitizeTssODataCapture,
  type TssODataRequest,
} from './tssODataCapture.js';
import {
  TssStructuralDriftError,
  parseTssStructuralContract,
} from './tssStructuralDrift.js';

const SCHEDULE_URL =
  'https://tss.ucsd.edu/fiori#YSchedule-view?sap-app-origin-hint=';
const DEFAULT_PROFILE = resolve(
  homedir(),
  '.local',
  'share',
  'sungrid',
  'tss-browser-profile',
);
const MAX_CAPTURE_PAGES = 100;
const MAX_CAPTURE_ROWS = 25_000;

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} requires a value`);
  }
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function requestShape(urlValue: string | URL) {
  const url = new URL(urlValue);
  return {
    origin: url.origin,
    pathname: url.pathname,
    query: [...url.searchParams.entries()]
      .filter(([name]) => name !== '$skiptoken' && name !== '$skip')
      .sort(([left], [right]) => left.localeCompare(right)),
  };
}

function throwContinuationDrift(): never {
  throw new TssStructuralDriftError([
    {
      kind: 'endpoint',
      path: ['response', 'continuation'],
      expected: 'approved_paging_request',
    },
  ]);
}

function parseContinuationUrls(initialUrl: string, continuation: string) {
  try {
    const initial = new URL(initialUrl);
    return { initial, next: new URL(continuation, initial) };
  } catch {
    return throwContinuationDrift();
  }
}

export function validatedContinuationUrl(
  initialUrl: string,
  continuation: string,
): string {
  const { initial, next } = parseContinuationUrls(initialUrl, continuation);
  if (
    JSON.stringify(requestShape(initial)) !== JSON.stringify(requestShape(next))
  )
    return throwContinuationDrift();

  const paginationParameters = [...next.searchParams.keys()].filter(
    (name) => name === '$skiptoken' || name === '$skip',
  );
  if (paginationParameters.length !== 1) return throwContinuationDrift();
  return next.toString();
}

type ODataSet = {
  declaredTotal: number | null;
  pages: number;
  continuationNeeded: boolean;
  rows: unknown[];
};

const odataEnvelopeSchema = z
  .object({
    '@odata.context': z.string().min(1).optional(),
    '@odata.count': z.number().int().nonnegative().optional(),
    '@odata.nextLink': z.string().min(1).optional(),
    value: z.array(z.unknown()),
  })
  .strict();

export function parseODataEnvelope(value: unknown) {
  return parseTssStructuralContract(odataEnvelopeSchema, value, [
    'response',
    'envelope',
  ]);
}

type TssODataPageResponse = {
  body: string;
  contentType: string | null;
  responseUrl: string;
  status: number;
};

function parseTssResponseBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new TssStructuralDriftError([
      {
        kind: 'type',
        path: ['response', 'body'],
        expected: 'json_object',
      },
    ]);
  }
}

export function parseTssODataPage(
  requestUrl: string,
  result: TssODataPageResponse,
) {
  if ([401, 403, 429].includes(result.status)) {
    throw new Error(
      `TSS access stop (${result.status}); no retry was attempted`,
    );
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `TSS request failed (${result.status}); no retry was attempted`,
    );
  }
  if (!result.contentType?.toLowerCase().includes('application/json')) {
    throw new TssStructuralDriftError([
      {
        kind: 'type',
        path: ['response', 'content_type'],
        expected: 'application/json',
      },
    ]);
  }
  assertApprovedTssResponseUrl(requestUrl, result.responseUrl);

  const record = parseODataEnvelope(parseTssResponseBody(result.body));
  return {
    declaredTotal: record['@odata.count'] ?? null,
    continuation: record['@odata.nextLink'] ?? null,
    rows: record.value,
  };
}

async function fetchPage(page: Page, url: string) {
  try {
    if (new URL(page.url()).origin !== 'https://tss.ucsd.edu') {
      throw new TssStructuralDriftError([
        {
          kind: 'endpoint',
          path: ['browser', 'page', 'origin'],
          expected: 'approved_tss_origin',
        },
      ]);
    }
  } catch (error) {
    if (error instanceof TssStructuralDriftError) throw error;
    throw new TssStructuralDriftError([
      {
        kind: 'endpoint',
        path: ['browser', 'page', 'origin'],
        expected: 'approved_tss_origin',
      },
    ]);
  }

  const result = await page.evaluate(async (requestUrl) => {
    const response = await fetch(requestUrl, {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      method: 'GET',
      redirect: 'error',
    });
    return {
      body: await response.text(),
      contentType: response.headers.get('content-type'),
      responseUrl: response.url,
      status: response.status,
    };
  }, url);

  return parseTssODataPage(url, result);
}

async function fetchSet(
  page: Page,
  request: TssODataRequest,
): Promise<ODataSet> {
  const rows: unknown[] = [];
  const pageSize = Number(new URL(request.url).searchParams.get('$top'));
  let declaredTotal: number | null = null;
  let pages = 0;
  let nextUrl: string | null = request.url;
  const visited = new Set<string>();
  while (nextUrl) {
    if (pages >= MAX_CAPTURE_PAGES)
      throw new Error('TSS capture exceeded the approved page budget');

    if (visited.has(nextUrl)) throw new Error('TSS continuation loop detected');
    visited.add(nextUrl);
    const result = await fetchPage(page, nextUrl);
    const { declaredTotal: pageDeclaredTotal } = result;
    pages += 1;
    rows.push(...result.rows);
    if (rows.length > MAX_CAPTURE_ROWS)
      throw new Error('TSS capture exceeded the approved row budget');

    if (pageDeclaredTotal !== null) {
      if (pageDeclaredTotal > MAX_CAPTURE_ROWS)
        throw new Error('TSS declared count exceeds the approved row budget');

      if (declaredTotal !== null && declaredTotal !== pageDeclaredTotal)
        throw new Error('TSS declared count changed during pagination');

      declaredTotal = pageDeclaredTotal;
      if (rows.length > declaredTotal)
        throw new Error('TSS returned more rows than its declared count');
    }
    nextUrl = result.continuation
      ? validatedContinuationUrl(request.url, result.continuation)
      : null;
    if (nextUrl && declaredTotal !== null) {
      const expectedPages = Math.max(1, Math.ceil(declaredTotal / pageSize));
      if (pages >= expectedPages || rows.length >= declaredTotal)
        throw new Error('TSS continued beyond its declared result set');
    }
    if (nextUrl) {
      await new Promise<void>((done) => {
        setTimeout(done, 1_000);
      });
    }
  }
  return {
    declaredTotal,
    pages,
    continuationNeeded: declaredTotal === null || declaredTotal !== rows.length,
    rows,
  };
}

async function waitForOperator() {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await input.question(
    'Complete UCSD SSO/Duo in the dedicated browser, open Schedule of Classes, then press Enter here. ',
  );
  input.close();
}

export async function writePrivateArtifact(pathname: string, value: unknown) {
  const temporaryPath = `${pathname}.${process.pid}-${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, pathname);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function persistSanitizedTssCapture(
  pathname: string,
  input: unknown,
) {
  const artifact = sanitizeTssODataCapture(input);
  await mkdir(dirname(pathname), { recursive: true });
  await writePrivateArtifact(pathname, artifact);
  return artifact;
}

export function formatTssCaptureError(error: unknown) {
  if (error instanceof TssStructuralDriftError)
    return JSON.stringify(error.report, null, 2);
  return JSON.stringify(
    {
      schema_version: 'tss-capture-diagnostic-v1',
      outcome: 'failed',
      reason: 'capture_failed',
    },
    null,
    2,
  );
}

export function writeTssCaptureError(
  error: unknown,
  write: (message: string) => void = (message) => console.error(message),
) {
  write(formatTssCaptureError(error));
}

type TssCaptureOutputPorts = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

const consoleOutputPorts: TssCaptureOutputPorts = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

export async function runTssCaptureOutputBoundary(
  pathname: string,
  input: unknown,
  output: TssCaptureOutputPorts = consoleOutputPorts,
) {
  try {
    const artifact = await persistSanitizedTssCapture(pathname, input);
    output.stdout(
      JSON.stringify(
        {
          output: pathname,
          modules: artifact.coverage.source_counts.modules,
          events: artifact.coverage.source_counts.events,
          complete: artifact.coverage.complete,
          source_updated_at: artifact.source_updated_at,
        },
        null,
        2,
      ),
    );
    return true;
  } catch (error) {
    writeTssCaptureError(error, output.stderr);
    return false;
  }
}

export async function secureProfileDirectory(profilePath: string) {
  await mkdir(profilePath, { recursive: true, mode: 0o700 });
  const profileStats = await lstat(profilePath);
  if (!profileStats.isDirectory() || profileStats.isSymbolicLink())
    throw new Error('TSS browser profile must be a real directory');

  if (
    typeof process.getuid === 'function' &&
    profileStats.uid !== process.getuid()
  )
    throw new Error('TSS browser profile must be owned by the current user');

  if ((await realpath(profilePath)) !== profilePath)
    throw new Error('TSS browser profile path cannot contain symbolic links');

  await chmod(profilePath, 0o700);
}

async function main() {
  const term = argument('--term', 'FA26');
  if (term !== 'FA26')
    throw new Error('the attended capture currently supports FA26 only');

  const configPath = argument('--config', 'config/catalog-snapshot.ucsd.yaml');
  const outputPath = resolve(
    argument('--output', `data/tss-capture/${term}.json`),
  );
  const profilePath = resolve(argument('--profile', DEFAULT_PROFILE));
  const config = await loadCatalogSnapshotConfig(configPath);
  const requests = buildTssODataRequests(
    { academicYear: '2026', academicPeriod: '2' },
    Number(argument('--page-size', '250')),
  );

  await secureProfileDirectory(profilePath);
  const context = await chromium.launchPersistentContext(profilePath, {
    acceptDownloads: false,
    headless: false,
    serviceWorkers: 'block',
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(SCHEDULE_URL);
    await waitForOperator();
    if (new URL(page.url()).origin !== 'https://tss.ucsd.edu')
      throw new Error('Schedule of Classes is not open on the approved origin');

    const [modulesRequest, eventsRequest] = requests;
    if (!modulesRequest || !eventsRequest)
      throw new Error('TSS request builder returned an incomplete request set');

    const modules = await fetchSet(page, modulesRequest);
    const events = await fetchSet(page, eventsRequest);
    const moduleSubjects = modules.rows.flatMap((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
      const course = (row as { [key: string]: unknown }).CourseAbbr;
      if (typeof course !== 'string' || !course.includes('-')) return [];
      return [course.split('-', 1)[0]!];
    });
    const succeeded = await runTssCaptureOutputBoundary(outputPath, {
      term,
      sourceTerm: { academicYear: '2026', academicPeriod: '2' },
      requestedSubjects: [
        ...new Set([...config.configured_subjects, ...moduleSubjects]),
      ].sort(),
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: null,
      sourceUpdatedAtProvenance: 'unavailable',
      modules,
      events,
    });
    if (!succeeded) process.exitCode = 1;
  } finally {
    await context.close();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    writeTssCaptureError(error);
    process.exitCode = 1;
  }
}
