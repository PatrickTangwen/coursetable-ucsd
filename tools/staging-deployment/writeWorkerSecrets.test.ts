import { describe, expect, it } from 'vitest';

import { workerSecrets } from './writeWorkerSecrets.js';

describe('staging Worker secret bundle', () => {
  it('contains only runtime secrets and never migration or backup credentials', () => {
    const environment = Object.fromEntries(
      [
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
        'RESEND_API_KEY',
        'SESSION_SECRET',
        'TELEMETRY_HMAC_KEY',
      ].map((name) => [name, `${name.toLowerCase()}-value`]),
    );
    const secrets = workerSecrets(environment);

    expect(Object.keys(secrets).sort()).toEqual(
      Object.keys(environment).sort(),
    );
    expect(secrets).not.toHaveProperty('NEON_MIGRATION_DATABASE_URL');
    expect(secrets).not.toHaveProperty('NEON_DIRECT_DATABASE_URL');
    expect(secrets).not.toHaveProperty('R2_CATALOG_SECRET_ACCESS_KEY');
  });
});
