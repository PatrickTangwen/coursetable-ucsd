import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildWorkerConfig } from './prepareWorkerDeployment.js';

const root = path.resolve(process.cwd());
const environment = {
  CLOUDFLARE_STAGING_HOSTNAME: 'staging.sungridplanner.com',
  CLOUDFLARE_WORKER_NAME: 'sungrid-staging',
  HYPERDRIVE_CONFIG_ID: '1234567890abcdef1234567890abcdef',
  R2_CATALOG_BUCKET: 'sungrid-staging-catalog',
  VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
};

describe('staging Worker deployment configuration', () => {
  it('generates only the accepted custom-domain and Free-plan shape', async () => {
    const source = await readFile(
      path.join(root, 'worker/wrangler.jsonc'),
      'utf8',
    );
    const config = buildWorkerConfig(source, environment);

    expect(config).toMatchObject({
      name: 'sungrid-staging',
      workers_dev: false,
      preview_urls: false,
      routes: [{ pattern: 'staging.sungridplanner.com', custom_domain: true }],
      r2_buckets: [
        {
          binding: 'CATALOG_BUCKET',
          bucket_name: 'sungrid-staging-catalog',
        },
      ],
      hyperdrive: [
        {
          binding: 'APP_DB_HYPERDRIVE_NO_CACHE',
          id: environment.HYPERDRIVE_CONFIG_ID,
        },
      ],
      vars: {
        CLOUDFLARE_PLAN_IDENTITY: 'Workers Free',
        WORKERS_FREE_REQUESTS_PER_DAY: '100000',
        WORKERS_FREE_CPU_MS_PER_INVOCATION: '10',
        WORKERS_FREE_EXTERNAL_SUBREQUESTS_PER_INVOCATION: '50',
        WORKERS_FREE_CRON_TRIGGERS_PER_ACCOUNT: '5',
        WORKERS_FREE_STATIC_ASSETS_PER_VERSION: '20000',
        VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
      },
    });
    expect(config.vars).not.toHaveProperty('VERIFICATION_EMAIL_FROM_ADDRESS');
  });

  it('rejects any non-staging public hostname', async () => {
    const source = await readFile(
      path.join(root, 'worker/wrangler.jsonc'),
      'utf8',
    );

    expect(() =>
      buildWorkerConfig(source, {
        ...environment,
        CLOUDFLARE_STAGING_HOSTNAME: 'sungridplanner.com',
      }),
    ).toThrow('Unexpected staging hostname');
  });
});
