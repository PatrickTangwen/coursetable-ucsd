import { isObject, stagingContract } from './stagingContract.js';

type Config = {
  accountId: string;
  apiToken: string;
  bucket: string;
  hostname: string;
  hyperdriveId: string;
  publishedObjectReadbacks: number;
  worker: string;
};

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

// Workers rate-plan identities documented by Cloudflare: the Tenant
// "Available subscriptions" reference lists WORKERS_PAID and the
// PARTNERS_WORKERS_* plans; workers_free is the zero-price Workers plan.
const workerRatePlanIds = new Set([
  'workers_free',
  'workers_paid',
  'partners_workers_basic',
  'partners_workers_ent',
  'partners_workers_ss',
]);
const freeWorkerRatePlanIds = new Set(['free', 'workers_free']);

export async function verifyFreeBoundary(
  config: Config,
  fetcher: Fetcher = fetch,
) {
  if (
    config.worker !== stagingContract.worker ||
    config.hostname !== stagingContract.hostname ||
    config.bucket !== stagingContract.bucket
  )
    throw new Error('Unexpected Cloudflare staging identity');
  if (
    !Number.isInteger(config.publishedObjectReadbacks) ||
    config.publishedObjectReadbacks < 1
  )
    throw new Error('Term Archive R2 readback evidence is missing');
  const api = (pathname: string) => cloudflareApi(config, pathname, fetcher);

  const workerSubscriptionEvidence = proveWorkerSubscriptionIdentity(
    arrayResult(await api('/subscriptions')),
  );

  // Standard is Cloudflare's current pricing model for every plan (run
  // 29222442338 observed it on the proven subscription-free account), so it
  // is not a paid signal by itself; the subscription readback above is the
  // plan gate. Only the legacy paid Unbound model, or an unknown model,
  // fails closed here. The Free CPU/subrequest caps are plan-enforced, not
  // script settings, so there is no per-script limits readback.
  const accountSettings = object(await api('/workers/account-settings'));
  const usageModel = accountSettings.default_usage_model;
  if (usageModel === 'unbound')
    throw new Error('Workers Unbound paid usage model is enabled');
  if (usageModel !== 'standard' && usageModel !== 'bundled') {
    throw new Error(
      `Unexpected Cloudflare Worker usage model (observed=${String(usageModel)})`,
    );
  }

  const subdomain = object(
    await api(
      `/workers/scripts/${encodeURIComponent(config.worker)}/subdomain`,
    ),
  );
  if (subdomain.enabled !== false || subdomain.previews_enabled !== false)
    throw new Error('workers.dev or Worker preview URLs are enabled');

  const scripts = arrayResult(await api('/workers/scripts?per_page=100'));
  let accountCronTriggers = 0;
  let workerRoutes: string[] | null = null;
  for (const scriptValue of scripts) {
    const script = object(scriptValue);
    const { id } = script;
    if (typeof id !== 'string') throw new Error('Worker identity is invalid');
    if (id === config.worker) {
      if (workerRoutes !== null)
        throw new Error('Worker identity is ambiguous');
      workerRoutes = routePatterns(script.routes, config.worker);
    }
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
  if (workerRoutes === null)
    throw new Error('Worker identity is missing from account inventory');
  if (workerRoutes.length) throw new Error('Unexpected public Worker route');

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
  const r2Metrics = object(await api('/r2/metrics'));
  const standardObjects = observedObjects(r2Metrics.standard);
  const infrequentAccessObjects = observedObjects(r2Metrics.infrequentAccess);
  if (infrequentAccessObjects !== 0)
    throw new Error('Staging Catalog uses R2 Infrequent Access storage');

  const hyperdrive = object(
    await api(`/hyperdrive/configs/${encodeURIComponent(config.hyperdriveId)}`),
  );
  if (hyperdrive.id !== config.hyperdriveId)
    throw new Error('Unexpected staging Hyperdrive identity');
  if (object(hyperdrive.caching).disabled !== true)
    throw new Error('Staging Hyperdrive query caching is enabled');
  const originConnectionLimit = hyperdrive.origin_connection_limit;
  if (typeof originConnectionLimit !== 'number' || originConnectionLimit > 20)
    throw new Error('Staging Hyperdrive exceeds the Free connection limit');

  return {
    result: 'passed',
    plan: 'Workers Free',
    subscriptionReadback: true,
    ...workerSubscriptionEvidence,
    workersPaidSubscriptionPresent: false,
    workerUsageModel: usageModel,
    workersDevEnabled: false,
    previewUrlsEnabled: false,
    workerRoutes,
    workerDomains: domains,
    accountCronTriggers,
    r2StorageClass: 'Standard',
    r2DevEnabled: false,
    r2CustomDomains: customDomains.length,
    r2ObservedStandardObjects: standardObjects,
    r2ObservedInfrequentAccessObjects: infrequentAccessObjects,
    r2PublishedObjectReadbacks: config.publishedObjectReadbacks,
    hyperdriveCachingDisabled: true,
    hyperdriveOriginConnectionLimit: originConnectionLimit,
    acceptedLimits: stagingContract.freeLimits,
  };
}

function cloudflareApi(config: Config, pathname: string, fetcher: Fetcher) {
  return cloudflareApiUrl(
    config,
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}${pathname}`,
    pathname,
    fetcher,
  );
}

async function cloudflareApiUrl(
  config: Config,
  url: string,
  pathname: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(url, {
    headers: { authorization: `Bearer ${config.apiToken}` },
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isObject(payload) || payload.success !== true) {
    const [safePath] = pathname.split('?');
    throw new Error(
      `Cloudflare verification failed for ${safePath ?? pathname}`,
    );
  }
  return payload.result;
}

function routePatterns(value: unknown, worker: string) {
  if (!Array.isArray(value))
    throw new Error('Worker route inventory is missing');
  return value.map((routeValue) => {
    const route = object(routeValue);
    if (
      typeof route.pattern !== 'string' ||
      (route.script !== undefined && route.script !== worker)
    )
      throw new Error('Worker route identity is invalid');
    return route.pattern;
  });
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

function observedObjects(value: unknown) {
  const tier = object(value);
  const counts = [tier.published, tier.uploaded].map((state) => {
    const count = object(state).objects;
    if (typeof count !== 'number' || count < 0)
      throw new Error('Cloudflare R2 metrics are invalid');
    return count;
  });
  return Math.max(...counts);
}

function ratePlanId(plan: { [key: string]: unknown }) {
  return typeof plan.id === 'string' ? plan.id.toLowerCase() : null;
}

// Workers Free is the account default, not an add-on subscription: a Free
// account has no Workers subscription record, while every paid Workers
// identity is billed through one. At most one record may classify as
// Workers; an identified record must still prove the Free identity, and any
// unclassified record whose rate-plan id, scope, or sets mention Workers
// fails closed rather than passing as Free.
function proveWorkerSubscriptionIdentity(
  subscriptions: { [key: string]: unknown }[],
) {
  const workerSubscriptions = subscriptions.filter(isWorkerSubscription);
  if (workerSubscriptions.length > 1) {
    throw new Error(
      'Workers subscription identity is ambiguous ' +
        `(${classifySubscriptions(subscriptions, workerSubscriptions.length)})`,
    );
  }
  if (
    subscriptions.some(
      (subscription) =>
        !isWorkerSubscription(subscription) && isWorkersLike(subscription),
    )
  ) {
    throw new Error(
      'Workers subscription identity is unrecognized ' +
        `(${classifySubscriptions(subscriptions, workerSubscriptions.length)})`,
    );
  }
  const [workerSubscription] = workerSubscriptions;
  if (!workerSubscription) {
    return {
      workerSubscriptionPresent: false,
      planEvidence:
        'no Workers subscription record; Workers Free needs no add-on subscription',
    };
  }
  const workerRatePlan = object(workerSubscription.rate_plan);
  if (
    !freeWorkerRatePlanIds.has(ratePlanId(workerRatePlan) ?? '') ||
    workerSubscription.price !== 0 ||
    !['Provisioned', 'Paid'].includes(String(workerSubscription.state))
  )
    throw new Error('Workers Paid subscription is enabled');
  if (workerRatePlan.externally_managed !== false)
    throw new Error('Workers plan has an external upgrade authority');
  if (workerRatePlan.is_contract !== false)
    throw new Error('Workers plan has a contract upgrade authority');
  return {
    workerSubscriptionPresent: true,
    workerSubscriptionRatePlan: workerRatePlan.id,
    workerSubscriptionState: workerSubscription.state,
    workerSubscriptionExternallyManaged: workerRatePlan.externally_managed,
    workerSubscriptionContract: workerRatePlan.is_contract,
    planEvidence: 'Free, zero-price, non-contract subscription readback',
  };
}

function isWorkerSubscription(subscription: { [key: string]: unknown }) {
  const { rate_plan: ratePlan } = subscription;
  const plan = object(ratePlan);
  if (plan.scope === 'workers') return true;
  if (workerRatePlanIds.has(ratePlanId(plan) ?? '')) return true;
  if (plan.sets === undefined || plan.sets === null) return false;
  return arrayValue(plan.sets).includes('workers');
}

function mentionsWorkers(value: unknown) {
  return typeof value === 'string' && value.toLowerCase().includes('workers');
}

// Deliberately broader than the classifier: any Workers-flavored signal on
// an entry the classifier does not match must fail closed as unrecognized
// instead of letting the account pass as Free.
function isWorkersLike(subscription: { [key: string]: unknown }) {
  const plan = object(subscription.rate_plan);
  return (
    mentionsWorkers(plan.id) ||
    mentionsWorkers(plan.scope) ||
    (Array.isArray(plan.sets) && plan.sets.some(mentionsWorkers))
  );
}

// Redacted classification for the fail-closed identity error: only derived
// shapes plus the rate-plan id/state/zero-price of entries the classifier
// itself identifies as Workers subscriptions — the same entries whose
// rate-plan id and state the deployment evidence contract publishes.
// Unclassified plan ids, states, prices, and record ids are never echoed;
// a near-miss identity is reported only as the derived workersLike flag,
// computed by the same predicate that drives the fail-closed guard.
function classifySubscriptions(
  subscriptions: { [key: string]: unknown }[],
  matched: number,
) {
  const entries = subscriptions.map((subscription) => {
    const plan = object(subscription.rate_plan);
    const classified = isWorkerSubscription(subscription);
    const id = ratePlanId(plan);
    const { sets, scope } = plan;
    const setsShape =
      sets === undefined
        ? 'absent'
        : sets === null
          ? 'null'
          : Array.isArray(sets)
            ? `array(${sets.length},workers=${String(sets.includes('workers'))})`
            : typeof sets;
    return [
      `id=${classified ? String(id) : 'unrelated'}`,
      `workersLike=${String(isWorkersLike(subscription))}`,
      `scope=${typeof scope === 'string' ? scope : typeof scope}`,
      `sets=${setsShape}`,
      `state=${classified ? String(subscription.state) : 'unrelated'}`,
      `zeroPrice=${classified ? String(subscription.price === 0) : 'unrelated'}`,
    ].join(' ');
  });
  return [`matched=${matched} total=${subscriptions.length}`, ...entries].join(
    '; ',
  );
}
