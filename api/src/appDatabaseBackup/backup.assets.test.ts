import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('App DB backup operational assets', () => {
  it('declares a gated daily staging backup and disposable restore drill', async () => {
    const workflow = await readFile(
      path.join(root, '.github/workflows/app-db-backup.yml'),
      'utf8',
    );

    expect(workflow).toContain('schedule:');
    expect(workflow).toContain("cron: '17 8 * * *'");
    expect(workflow).toContain("vars.APP_DB_BACKUP_ENABLED == 'true'");
    expect(workflow).toContain('environment: Staging');
    expect(workflow).toContain('APP_DB_POSTGRES_TOOLS_IMAGE: postgres:18');
    expect(workflow).toContain('app-db:backup');
    expect(workflow).toContain('app-db:restore:verify');
    expect(workflow).toContain('R2_BACKUP_BUCKET');
    expect(workflow).toContain('R2_CATALOG_BUCKET: sungrid-staging-catalog');
    expect(workflow).toContain('R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT');
    expect(workflow).toContain('R2_BACKUP_ACCESS_KEY_ID');
    expect(workflow).toContain('R2_BACKUP_SECRET_ACCESS_KEY');
    expect(workflow).toContain('NEON_DIRECT_DATABASE_URL');
    expect(workflow).toContain('if: always()');
    expect(
      workflow
        .split(/\r?\n/u)
        .some((line) => line.trimStart().startsWith('CATALOG_BUCKET:')),
    ).toBe(false);
    expect(workflow).not.toContain('r2.dev');
    expect(workflow).not.toContain('production');
  });

  it('contains no destructive down-migration or restore cleanup flags', async () => {
    const assets = await Promise.all(
      [
        'api/src/appDatabaseBackup/postgresTools.ts',
        'api/src/appDatabaseBackup/backup.command.ts',
        'api/src/appDatabaseBackup/restore.command.ts',
        '.github/workflows/app-db-backup.yml',
      ].map(async (file) => ({
        file,
        source: await readFile(path.join(root, file), 'utf8'),
      })),
    );

    for (const { source } of assets)
      expect(source).not.toMatch(/db:down|migrate:down|--clean|dropdb/u);
  });
});
