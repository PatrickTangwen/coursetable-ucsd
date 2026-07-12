import { parse } from 'jsonc-parser';

const accepted = {
  hostname: 'staging.sungridplanner.com',
  worker: 'sungrid-staging',
  catalogBucket: 'sungrid-staging-catalog',
};

export function buildWorkerConfig(
  source: string,
  environment: { [key: string]: string | undefined },
) {
  requireExact(
    'staging hostname',
    environment.CLOUDFLARE_STAGING_HOSTNAME,
    accepted.hostname,
  );
  requireExact(
    'staging Worker name',
    environment.CLOUDFLARE_WORKER_NAME,
    accepted.worker,
  );
  requireExact(
    'staging Catalog bucket',
    environment.R2_CATALOG_BUCKET,
    accepted.catalogBucket,
  );
  const hyperdriveId = environment.HYPERDRIVE_CONFIG_ID;
  if (!hyperdriveId || !/^[a-f\d]{32}$/u.test(hyperdriveId))
    throw new Error('Unexpected staging Hyperdrive configuration ID');
  requireExact(
    'verification sender domain',
    environment.VERIFICATION_EMAIL_SENDER_DOMAIN,
    'mail.sungridplanner.com',
  );
  const fromAddress = environment.VERIFICATION_EMAIL_FROM_ADDRESS;
  if (!fromAddress?.endsWith('@mail.sungridplanner.com'))
    throw new Error('Unexpected verification from address');

  const errors: { error: number; offset: number; length: number }[] = [];
  const config = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as { [key: string]: unknown };
  if (errors.length)
    throw new Error('Worker Wrangler configuration is invalid');
  if (config.workers_dev !== false || config.preview_urls !== false)
    throw new Error('Provider-default Worker URLs must stay disabled');

  config.name = accepted.worker;
  config.routes = [{ pattern: accepted.hostname, custom_domain: true }];
  config.r2_buckets = [
    { binding: 'CATALOG_BUCKET', bucket_name: accepted.catalogBucket },
  ];
  config.hyperdrive = [
    { binding: 'APP_DB_HYPERDRIVE_NO_CACHE', id: hyperdriveId },
  ];
  config.vars = {
    ...(config.vars as { [key: string]: unknown }),
    CLOUDFLARE_PLAN_IDENTITY: 'Workers Free',
    WORKERS_FREE_REQUESTS_PER_DAY: '100000',
    WORKERS_FREE_CPU_MS_PER_INVOCATION: '10',
    WORKERS_FREE_EXTERNAL_SUBREQUESTS_PER_INVOCATION: '50',
    WORKERS_FREE_CRON_TRIGGERS_PER_ACCOUNT: '5',
    WORKERS_FREE_STATIC_ASSETS_PER_VERSION: '20000',
    USAGE_ALLOWANCE_WORKER_REQUESTS: '3100000',
    VERIFICATION_EMAIL_FROM_ADDRESS: fromAddress,
    VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
  };
  return config;
}

function requireExact(
  label: string,
  actual: string | undefined,
  expected: string,
) {
  if (actual !== expected) throw new Error(`Unexpected ${label}`);
}
