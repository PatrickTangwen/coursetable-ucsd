import { describe, expect, it } from 'vitest';

import { createHostedR2BackupRuntime } from './r2Runtime.js';

const environment = {
  APP_DB_BACKUP_ENVIRONMENT: 'staging',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  R2_BACKUP_BUCKET: 'sungrid-staging-app-db-backups',
  R2_CATALOG_BUCKET: 'sungrid-staging-catalog',
  R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT: '2026-07-11T20:00:00.000Z',
  R2_BACKUP_ACCESS_KEY_ID: 'local-access-key',
  R2_BACKUP_SECRET_ACCESS_KEY: 'local-secret-key',
};

describe('hosted R2 backup runtime', () => {
  it('requires a separately named bucket with private-access evidence', () => {
    const runtime = createHostedR2BackupRuntime(environment);
    try {
      expect(runtime.namespace).toBe('staging/app-db/');
    } finally {
      runtime.client.destroy();
    }
  });

  it('rejects the Catalog bucket as the App DB backup store', () => {
    expect(() =>
      createHostedR2BackupRuntime({
        ...environment,
        R2_BACKUP_BUCKET: environment.R2_CATALOG_BUCKET,
      }),
    ).toThrow('bucket separate from Catalog');
  });

  it('requires timestamped evidence that public bucket access was disabled', () => {
    expect(() =>
      createHostedR2BackupRuntime({
        ...environment,
        R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT: '',
      }),
    ).toThrow('R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT');
    expect(() =>
      createHostedR2BackupRuntime({
        ...environment,
        R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT: 'not-a-timestamp',
      }),
    ).toThrow('private-access evidence');
  });
});
