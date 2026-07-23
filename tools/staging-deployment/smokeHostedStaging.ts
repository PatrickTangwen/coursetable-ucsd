import type { HostedDeploymentContract } from './productionContract.js';
import { isObject, stagingContract } from './stagingContract.js';

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SmokeCheck = {
  method: string;
  pathname: string;
  status: number;
  body?: unknown;
  validate?: (body: string) => void;
};

type ReadinessOptions = {
  overallTimeoutMs: number;
  attemptTimeoutMs: number;
  delayMs: number;
  sleep: (delayMs: number) => Promise<void>;
  now: () => number;
};

const defaultReadiness: ReadinessOptions = {
  overallTimeoutMs: 300_000,
  attemptTimeoutMs: 10_000,
  delayMs: 10_000,
  sleep: (delayMs) =>
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    }),
  now: () => performance.now(),
};

export function runHostedStagingSmoke(
  origin: string,
  fetcher: Fetcher = fetch,
  repeats = 3,
  readinessOverrides: Partial<ReadinessOptions> = {},
) {
  return runHostedDeploymentSmoke(
    origin,
    stagingContract,
    fetcher,
    repeats,
    readinessOverrides,
  );
}

export async function runHostedDeploymentSmoke(
  origin: string,
  contract: HostedDeploymentContract,
  fetcher: Fetcher = fetch,
  repeats = 3,
  readinessOverrides: Partial<ReadinessOptions> = {},
) {
  if (origin !== `https://${contract.hostname}`)
    throw new Error(`Unexpected ${contract.target} origin`);
  if (!Number.isInteger(repeats) || repeats < 3)
    throw new Error('Hosted smoke requires at least three repetitions');
  const readiness = { ...defaultReadiness, ...readinessOverrides };
  if (
    !Number.isInteger(readiness.overallTimeoutMs) ||
    readiness.overallTimeoutMs < 1 ||
    !Number.isInteger(readiness.attemptTimeoutMs) ||
    readiness.attemptTimeoutMs < 1 ||
    !Number.isInteger(readiness.delayMs) ||
    readiness.delayMs < 0
  )
    throw new Error('Hosted smoke readiness policy is invalid');

  const readinessDeadline = readiness.now() + readiness.overallTimeoutMs;
  const metadata = await waitForHostedOrigin(
    fetcher,
    origin,
    readiness,
    readinessDeadline,
  );
  const parsed = JSON.parse(metadata) as { terms?: { term?: unknown }[] };
  const term = parsed.terms?.[0]?.term;
  if (typeof term !== 'string' || !/^[A-Z\d]+$/u.test(term))
    throw new Error('Hosted Catalog metadata has no Supported Term');

  await waitForHostedLoginBoundary(
    fetcher,
    origin,
    contract.publicLoginEnabled,
    readiness,
    readinessDeadline,
  );

  const checks: SmokeCheck[] = [
    { method: 'GET', pathname: '/', status: 200 },
    { method: 'GET', pathname: '/api/catalog/metadata', status: 200 },
    {
      method: 'GET',
      pathname: `/api/catalog/public/${term}`,
      status: 200,
      validate: assertLightweightCatalogList,
    },
    {
      method: 'GET',
      pathname: `/api/catalog/details/${term}`,
      status: 200,
      validate: assertCatalogDetails,
    },
    {
      method: 'GET',
      pathname: '/api/auth/current-user',
      status: 200,
      validate: assertUnauthenticatedSession,
    },
    { method: 'POST', pathname: '/api/auth/logout', status: 200 },
    ...(contract.target === 'staging'
      ? [{ method: 'GET', pathname: '/api/savedSearches', status: 401 }]
      : []),
    { method: 'GET', pathname: '/api/savedWorksheets', status: 401 },
    {
      method: 'POST',
      pathname: '/api/auth/ucsd/request-verification',
      status: contract.publicLoginEnabled ? 400 : 404,
      body: { email: 'deployment-smoke@example.invalid' },
    },
  ];

  for (let repetition = 0; repetition < repeats; repetition += 1)
    for (const check of checks) await request(fetcher, origin, check);

  return {
    result: 'passed',
    origin,
    repeats,
    supportedTerm: term,
    paths: checks.map(({ method, pathname, status }) => ({
      method,
      pathname,
      expectedStatus: status,
    })),
    authenticatedIdentityCreated: false,
    publicLoginEnabled: contract.publicLoginEnabled,
    cpuLimitErrorsObserved: false,
  };
}

async function waitForHostedOrigin(
  fetcher: Fetcher,
  origin: string,
  readiness: ReadinessOptions,
  deadline: number,
) {
  const check = {
    method: 'GET',
    pathname: '/api/catalog/metadata',
    status: 200,
  };
  while (readiness.now() < deadline) {
    const remainingMs = deadline - readiness.now();
    const attemptTimeoutMs = Math.max(
      1,
      Math.ceil(Math.min(readiness.attemptTimeoutMs, remainingMs)),
    );
    const result = await fetchAttempt(
      fetcher,
      origin,
      check,
      AbortSignal.timeout(attemptTimeoutMs),
    );
    if (result.ok) return validateResponse(result.response, check);
    const remainingAfterAttempt = deadline - readiness.now();
    if (remainingAfterAttempt <= 0)
      throw new Error('Hosted staging origin readiness timed out');
    await readiness.sleep(Math.min(readiness.delayMs, remainingAfterAttempt));
  }
  throw new Error('Hosted staging origin readiness timed out');
}

async function waitForHostedLoginBoundary(
  fetcher: Fetcher,
  origin: string,
  publicLoginEnabled: boolean,
  readiness: ReadinessOptions,
  deadline: number,
) {
  const check: SmokeCheck = {
    method: 'POST',
    pathname: '/api/auth/ucsd/request-verification',
    status: publicLoginEnabled ? 400 : 404,
    body: { email: 'deployment-smoke@example.invalid' },
  };
  while (readiness.now() < deadline) {
    const remainingMs = deadline - readiness.now();
    const attemptTimeoutMs = Math.max(
      1,
      Math.ceil(Math.min(readiness.attemptTimeoutMs, remainingMs)),
    );
    const result = await fetchAttempt(
      fetcher,
      origin,
      check,
      AbortSignal.timeout(attemptTimeoutMs),
    );
    if (result.ok) {
      if (result.response.status === check.status)
        return validateResponse(result.response, check);
      if (!isTransitionalLoginStatus(result.response.status, check.status))
        return validateResponse(result.response, check);
    }
    const remainingAfterAttempt = deadline - readiness.now();
    if (remainingAfterAttempt <= 0)
      throw new Error('Hosted login boundary readiness timed out');
    await readiness.sleep(Math.min(readiness.delayMs, remainingAfterAttempt));
  }
  throw new Error('Hosted login boundary readiness timed out');
}

function isTransitionalLoginStatus(actual: number, expected: number) {
  return (
    (actual === 400 && expected === 404) || (actual === 404 && expected === 400)
  );
}

async function fetchAttempt(
  fetcher: Fetcher,
  origin: string,
  check: SmokeCheck,
  signal: AbortSignal,
): Promise<{ ok: true; response: Response } | { ok: false; error: unknown }> {
  try {
    return {
      ok: true,
      response: await fetcher(
        `${origin}${check.pathname}`,
        requestOptions(check, signal),
      ),
    };
  } catch (error) {
    return { ok: false, error };
  }
}

async function request(fetcher: Fetcher, origin: string, check: SmokeCheck) {
  const response = await fetcher(
    `${origin}${check.pathname}`,
    requestOptions(check),
  );
  return validateResponse(response, check);
}

function requestOptions(check: SmokeCheck, signal?: AbortSignal) {
  return {
    method: check.method,
    headers: check.body ? { 'content-type': 'application/json' } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined,
    redirect: 'error' as const,
    signal,
  };
}

async function validateResponse(response: Response, check: SmokeCheck) {
  const body = await response.text();
  if (
    /error\s*code\s*1102|cpu time limit|exceeded resource limits/iu.test(body)
  ) {
    throw new Error(
      `Workers Free CPU-limit incompatibility at ${check.method} ${check.pathname}`,
    );
  }
  if (response.status !== check.status) {
    throw new Error(
      `Hosted smoke ${check.method} ${check.pathname} returned ${response.status}; expected ${check.status}`,
    );
  }
  if (/workers\.dev|r2\.dev/iu.test(body)) {
    throw new Error(
      `Hosted smoke ${check.method} ${check.pathname} exposed a provider-default URL`,
    );
  }
  check.validate?.(body);
  return body;
}

function assertUnauthenticatedSession(body: string) {
  const parsed: unknown = JSON.parse(body);
  if (
    !isObject(parsed) ||
    parsed.authenticated !== false ||
    (parsed.user !== null && parsed.user !== undefined)
  ) {
    throw new Error(
      'Hosted smoke observed an unexpected authenticated Session',
    );
  }
}

function assertLightweightCatalogList(body: string) {
  const parsed: unknown = JSON.parse(body);
  if (
    !isObject(parsed) ||
    !Array.isArray(parsed.courses) ||
    parsed.courses.some(
      (course) =>
        isObject(course) && Object.hasOwn(course, 'grade_archive_records'),
    )
  )
    throw new Error('Hosted Catalog list is not a lightweight payload');
}

function assertCatalogDetails(body: string) {
  const parsed: unknown = JSON.parse(body);
  if (
    !isObject(parsed) ||
    !Array.isArray(parsed.courses) ||
    parsed.courses.some(
      (course) =>
        !isObject(course) || !Array.isArray(course.grade_archive_records),
    )
  )
    throw new Error('Hosted Catalog details payload is invalid');
}
