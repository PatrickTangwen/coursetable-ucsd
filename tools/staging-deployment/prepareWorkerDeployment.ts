import { parse } from 'jsonc-parser';

import type { HostedDeploymentContract } from './productionContract.js';
import { stagingContract } from './stagingContract.js';

export function buildWorkerConfig(
  source: string,
  environment: { [key: string]: string | undefined },
  contract: HostedDeploymentContract = stagingContract,
) {
  requireExact(
    `${contract.target} hostname`,
    environment[
      contract.target === 'staging'
        ? 'CLOUDFLARE_STAGING_HOSTNAME'
        : 'CLOUDFLARE_PRODUCTION_HOSTNAME'
    ],
    contract.hostname,
  );
  requireExact(
    `${contract.target} Worker name`,
    environment.CLOUDFLARE_WORKER_NAME,
    contract.worker,
  );
  requireExact(
    `${contract.target} Catalog bucket`,
    environment.R2_CATALOG_BUCKET,
    contract.bucket,
  );
  const hyperdriveId = environment.HYPERDRIVE_CONFIG_ID;
  if (!hyperdriveId || !/^[a-f\d]{32}$/u.test(hyperdriveId)) {
    throw new Error(
      `Unexpected ${contract.target} Hyperdrive configuration ID`,
    );
  }
  requireExact(
    'verification sender domain',
    environment.VERIFICATION_EMAIL_SENDER_DOMAIN,
    contract.senderDomain,
  );

  const errors: { error: number; offset: number; length: number }[] = [];
  const config = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as { [key: string]: unknown };
  if (errors.length)
    throw new Error('Worker Wrangler configuration is invalid');
  if (config.workers_dev !== false || config.preview_urls !== false)
    throw new Error('Provider-default Worker URLs must stay disabled');

  config.name = contract.worker;
  config.routes = [{ pattern: contract.hostname, custom_domain: true }];
  config.r2_buckets = [
    { binding: 'CATALOG_BUCKET', bucket_name: contract.bucket },
  ];
  config.hyperdrive = [
    { binding: 'APP_DB_HYPERDRIVE_NO_CACHE', id: hyperdriveId },
  ];
  config.vars = {
    ...(config.vars as { [key: string]: unknown }),
    CLOUDFLARE_PLAN_IDENTITY: 'Workers Free',
    WORKERS_FREE_REQUESTS_PER_DAY: String(contract.freeLimits.requestsPerDay),
    WORKERS_FREE_CPU_MS_PER_INVOCATION: String(
      contract.freeLimits.cpuMsPerInvocation,
    ),
    WORKERS_FREE_EXTERNAL_SUBREQUESTS_PER_INVOCATION: String(
      contract.freeLimits.externalSubrequestsPerInvocation,
    ),
    WORKERS_FREE_CRON_TRIGGERS_PER_ACCOUNT: String(
      contract.freeLimits.cronTriggersPerAccount,
    ),
    WORKERS_FREE_STATIC_ASSETS_PER_VERSION: String(
      contract.freeLimits.staticAssetsPerVersion,
    ),
    USAGE_ALLOWANCE_WORKER_REQUESTS: '3100000',
    PUBLIC_LOGIN_ENABLED: String(contract.publicLoginEnabled),
    VERIFICATION_EMAIL_SENDER_DOMAIN: contract.senderDomain,
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
