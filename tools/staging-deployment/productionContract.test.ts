import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildWorkerConfig } from './prepareWorkerDeployment.js';
import { createProductionContract } from './productionContract.js';

const root = path.resolve(process.cwd());
const environment = {
  DEPLOYMENT_TARGET: 'production',
  CLOUDFLARE_PRODUCTION_HOSTNAME: 'sungridplanner.com',
  CLOUDFLARE_WORKER_NAME: 'sungrid-production',
  HYPERDRIVE_CONFIG_ID: '1234567890abcdef1234567890abcdef',
  R2_CATALOG_BUCKET: 'sungrid-production-catalog',
  VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
  PRODUCTION_ISOLATION_VERIFIED_AT: '2026-07-13T20:00:00.000Z',
};

describe('Production deployment contract', () => {
  it('generates an isolated custom-domain Worker with public login disabled', async () => {
    const contract = createProductionContract(environment);
    const source = await readFile(
      path.join(root, 'worker/wrangler.jsonc'),
      'utf8',
    );
    const config = buildWorkerConfig(source, environment, contract);

    expect(contract).toMatchObject({
      target: 'production',
      artifactDirectory: 'production-deployment',
      hostname: 'sungridplanner.com',
      worker: 'sungrid-production',
      bucket: 'sungrid-production-catalog',
      publicLoginEnabled: false,
    });
    expect(config).toMatchObject({
      name: 'sungrid-production',
      workers_dev: false,
      preview_urls: false,
      routes: [{ pattern: 'sungridplanner.com', custom_domain: true }],
      r2_buckets: [
        {
          binding: 'CATALOG_BUCKET',
          bucket_name: 'sungrid-production-catalog',
        },
      ],
      vars: {
        PUBLIC_LOGIN_ENABLED: 'false',
        VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
      },
    });
  });

  it.each([
    ['CLOUDFLARE_PRODUCTION_HOSTNAME', 'staging.sungridplanner.com'],
    ['CLOUDFLARE_WORKER_NAME', 'sungrid-staging'],
    ['R2_CATALOG_BUCKET', 'sungrid-staging-catalog'],
  ])('rejects Staging reuse through %s', (name, value) => {
    expect(() =>
      createProductionContract({ ...environment, [name]: value }),
    ).toThrow('Production deployment must not reuse Staging');
  });

  it('requires a human isolation attestation without accepting secret values', () => {
    expect(() =>
      createProductionContract({
        ...environment,
        PRODUCTION_ISOLATION_VERIFIED_AT: '',
      }),
    ).toThrow('PRODUCTION_ISOLATION_VERIFIED_AT');
  });

  it('allows the separate protected login toggle path only with explicit authorization', () => {
    expect(() =>
      createProductionContract({
        ...environment,
        PUBLIC_LOGIN_ENABLED: 'true',
      }),
    ).toThrow('Production public login toggle is not authorized');

    const enabled = createProductionContract({
      ...environment,
      PUBLIC_LOGIN_ENABLED: 'true',
      PRODUCTION_LOGIN_TOGGLE_AUTHORIZED: 'true',
    });
    expect(enabled.publicLoginEnabled).toBe(true);

    const disabled = createProductionContract({
      ...environment,
      PUBLIC_LOGIN_ENABLED: 'false',
      PRODUCTION_LOGIN_TOGGLE_AUTHORIZED: 'true',
    });
    expect(disabled.publicLoginEnabled).toBe(false);
  });
});
