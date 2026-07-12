type Config = {
  accountId: string;
  apiToken: string;
  bucket: string;
  hostname: string;
  hyperdriveId: string;
  worker: string;
};

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function verifyFreeBoundary(
  config: Config,
  fetcher: Fetcher = fetch,
) {
  if (
    config.worker !== 'sungrid-staging' ||
    config.hostname !== 'staging.sungridplanner.com' ||
    config.bucket !== 'sungrid-staging-catalog'
  )
    throw new Error('Unexpected Cloudflare staging identity');
  const api = (pathname: string) => cloudflareApi(config, pathname, fetcher);

  const accountSettings = object(await api('/workers/account-settings'));
  const usageModel = accountSettings.default_usage_model;
  if (usageModel === 'standard')
    throw new Error('Workers Paid Standard usage model is enabled');
  if (usageModel !== 'bundled')
    throw new Error('Unexpected Cloudflare Worker usage model');

  const subdomain = object(
    await api(
      `/workers/scripts/${encodeURIComponent(config.worker)}/subdomain`,
    ),
  );
  if (subdomain.enabled !== false || subdomain.previews_enabled !== false)
    throw new Error('workers.dev or Worker preview URLs are enabled');

  const scripts = arrayResult(await api('/workers/scripts?per_page=100'));
  let accountCronTriggers = 0;
  for (const script of scripts) {
    const { id } = object(script);
    if (typeof id !== 'string') throw new Error('Worker identity is invalid');
    const schedulesResult = await api(
      `/workers/scripts/${encodeURIComponent(id)}/schedules`,
    );
    const schedules = Array.isArray(schedulesResult)
      ? schedulesResult
      : arrayValue(object(schedulesResult).schedules);
    accountCronTriggers += schedules.length;
  }
  if (accountCronTriggers > 5)
    throw new Error('Workers Free account Cron Trigger limit exceeded');

  const domains = arrayResult(await api('/workers/domains'))
    .filter(({ service }) => service === config.worker)
    .map(({ hostname }) => hostname);
  if (domains.length !== 1 || domains[0] !== config.hostname)
    throw new Error('Unexpected public Worker ingress');

  const bucket = object(
    await api(`/r2/buckets/${encodeURIComponent(config.bucket)}`),
  );
  if (bucket.storage_class !== 'Standard')
    throw new Error('Staging Catalog bucket is not R2 Standard');
  const managedDomain = object(
    await api(
      `/r2/buckets/${encodeURIComponent(config.bucket)}/domains/managed`,
    ),
  );
  if (managedDomain.enabled !== false)
    throw new Error('Staging Catalog r2.dev URL is enabled');
  const customDomains = arrayValue(
    object(
      await api(
        `/r2/buckets/${encodeURIComponent(config.bucket)}/domains/custom`,
      ),
    ).domains,
  );
  if (customDomains.length)
    throw new Error('Staging Catalog R2 custom domain is enabled');

  const hyperdrive = object(
    await api(`/hyperdrive/configs/${encodeURIComponent(config.hyperdriveId)}`),
  );
  if (hyperdrive.id !== config.hyperdriveId)
    throw new Error('Unexpected staging Hyperdrive identity');
  if (object(hyperdrive.caching).disabled !== true)
    throw new Error('Staging Hyperdrive query caching is enabled');
  const originConnectionLimit = hyperdrive.origin_connection_limit;
  if (
    originConnectionLimit !== undefined &&
    (typeof originConnectionLimit !== 'number' || originConnectionLimit > 20)
  )
    throw new Error('Staging Hyperdrive exceeds the Free connection limit');

  return {
    result: 'passed',
    plan: 'Workers Free',
    workerUsageModel: usageModel,
    planEvidence:
      'protected human provisioning plus non-Standard account usage model',
    workersDevEnabled: false,
    previewUrlsEnabled: false,
    workerDomains: domains,
    accountCronTriggers,
    r2StorageClass: 'Standard',
    r2DevEnabled: false,
    r2CustomDomains: customDomains.length,
    hyperdriveCachingDisabled: true,
    hyperdriveOriginConnectionLimit: originConnectionLimit ?? 20,
    acceptedLimits: {
      requestsPerDay: 100_000,
      cpuMsPerInvocation: 10,
      externalSubrequestsPerInvocation: 50,
      cronTriggersPerAccount: 5,
      staticAssetsPerVersion: 20_000,
    },
    automaticProviderUpgradeAuthorized: false,
  };
}

async function cloudflareApi(
  config: Config,
  pathname: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}${pathname}`,
    { headers: { authorization: `Bearer ${config.apiToken}` } },
  );
  const payload: unknown = await response.json();
  if (!response.ok || !isObject(payload) || payload.success !== true) {
    const [safePath] = pathname.split('?');
    throw new Error(
      `Cloudflare verification failed for ${safePath ?? pathname}`,
    );
  }
  return payload.result;
}

function arrayResult(value: unknown) {
  return arrayValue(value).map(object);
}

function arrayValue(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error('Cloudflare API result is invalid');
  return value;
}

function object(value: unknown): { [key: string]: unknown } {
  if (!isObject(value)) throw new Error('Cloudflare API result is invalid');
  return value;
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
