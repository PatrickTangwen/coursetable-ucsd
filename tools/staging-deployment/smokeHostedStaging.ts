type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const acceptedOrigin = 'https://staging.sungridplanner.com';

export async function runHostedStagingSmoke(
  origin: string,
  fetcher: Fetcher = fetch,
  repeats = 3,
) {
  if (origin !== acceptedOrigin) throw new Error('Unexpected staging origin');
  if (!Number.isInteger(repeats) || repeats < 3)
    throw new Error('Hosted smoke requires at least three repetitions');

  const metadata = await request(fetcher, origin, {
    method: 'GET',
    pathname: '/api/catalog/metadata',
    status: 200,
  });
  const parsed = JSON.parse(metadata) as { terms?: { term?: unknown }[] };
  const term = parsed.terms?.[0]?.term;
  if (typeof term !== 'string' || !/^[A-Z\d]+$/u.test(term))
    throw new Error('Hosted Catalog metadata has no Supported Term');

  const checks = [
    { method: 'GET', pathname: '/', status: 200 },
    { method: 'GET', pathname: '/api/catalog/metadata', status: 200 },
    { method: 'GET', pathname: `/api/catalog/public/${term}`, status: 200 },
    { method: 'GET', pathname: '/api/auth/current-user', status: 200 },
    { method: 'POST', pathname: '/api/auth/logout', status: 200 },
    { method: 'GET', pathname: '/api/savedSearches', status: 401 },
    { method: 'GET', pathname: '/api/savedWorksheets', status: 401 },
    {
      method: 'POST',
      pathname: '/api/auth/ucsd/request-verification',
      status: 400,
      body: { email: 'deployment-smoke@example.invalid' },
    },
  ] as const;

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
    cpuLimitErrorsObserved: false,
  };
}

async function request(
  fetcher: Fetcher,
  origin: string,
  check: {
    method: string;
    pathname: string;
    status: number;
    body?: unknown;
  },
) {
  const response = await fetcher(`${origin}${check.pathname}`, {
    method: check.method,
    headers: check.body ? { 'content-type': 'application/json' } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined,
    redirect: 'error',
  });
  const body = await response.text();
  if (response.status !== check.status) {
    throw new Error(
      `Hosted smoke ${check.method} ${check.pathname} returned ${response.status}; expected ${check.status}`,
    );
  }
  if (
    /workers\.dev|r2\.dev|error\s*code\s*1102|cpu time limit|exceeded resource limits/iu.test(
      body,
    )
  ) {
    throw new Error(
      `Hosted smoke ${check.method} ${check.pathname} exposed a provider-default URL or CPU-limit failure`,
    );
  }
  return body;
}
