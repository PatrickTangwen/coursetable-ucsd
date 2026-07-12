import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const runMigrationCommand = async (databaseUrl?: string) => {
  const environment = { ...process.env };

  if (databaseUrl) environment.DB_URL = databaseUrl;
  else delete environment.DB_URL;

  try {
    const { stdout } = await execFileAsync('bun', ['run', 'db:migrate'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: environment,
    });
    return { exitCode: 0, stderr: '', stdout };
  } catch (error) {
    const result = error as { code: number; stderr: string; stdout: string };
    return {
      exitCode: result.code,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  }
};

const runHostedMigrationCommand = async (directDatabaseUrl?: string) => {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DB_URL: 'postgresql://runtime.invalid/app',
  };
  if (directDatabaseUrl)
    environment.NEON_DIRECT_DATABASE_URL = directDatabaseUrl;
  else delete environment.NEON_DIRECT_DATABASE_URL;

  try {
    await execFileAsync('bun', ['run', 'db:migrate:hosted'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: environment,
    });
    return { exitCode: 0, stderr: '' };
  } catch (error) {
    const result = error as { code: number; stderr: string };
    return { exitCode: result.code, stderr: result.stderr };
  }
};

describe('App DB migration command', () => {
  it('resolves the real runner and fails before connecting without DB_URL', async () => {
    const result = await runMigrationCommand();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('env config missing: DB_URL');
  });

  it('keeps hosted migrations on the direct Neon connection contract', async () => {
    const result = await runHostedMigrationCommand();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      'env config missing: NEON_DIRECT_DATABASE_URL',
    );
  });

  it('does not expose a database URL or credential when migration fails', async () => {
    const databaseUrl =
      'postgresql://private-user:private-password@127.0.0.1:1/app';

    const result = await runMigrationCommand(databaseUrl);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('App DB migration failed');
    expect(result.stderr).not.toContain(databaseUrl);
    expect(result.stderr).not.toContain('private-user');
    expect(result.stderr).not.toContain('private-password');
  });

  it.skipIf(!process.env.APP_DB_MIGRATION_TEST_URL)(
    'applies the real migration command and safely reruns it',
    async () => {
      const databaseUrl = process.env.APP_DB_MIGRATION_TEST_URL!;

      const first = await runMigrationCommand(databaseUrl);
      const repeated = await runMigrationCommand(databaseUrl);

      expect(first.exitCode).toBe(0);
      expect(repeated.exitCode).toBe(0);
      expect(JSON.parse(first.stdout)).toEqual({
        schemaVersion: '0002_wild_skaar',
      });
      expect(JSON.parse(repeated.stdout)).toEqual({
        schemaVersion: '0002_wild_skaar',
      });
      expect(first.stdout).not.toContain(databaseUrl);
      expect(repeated.stdout).not.toContain(databaseUrl);

      const postgres = (await import('postgres')).default;
      const client = postgres(databaseUrl, { max: 1 });

      try {
        const tables = await client<{ tableName: string }[]>`
          select table_name as "tableName"
          from information_schema.tables
          where table_schema = 'public'
        `;
        const tableNames = new Set(tables.map(({ tableName }) => tableName));
        const indexes = await client<{ indexname: string }[]>`
          select indexname
          from pg_indexes
          where schemaname = 'public'
        `;
        const indexNames = new Set(indexes.map(({ indexname }) => indexname));
        const [journal] = await client<{ count: number }[]>`
          select count(*)::int as count from drizzle.__drizzle_migrations
        `;

        for (const tableName of [
          'appUsers',
          'emailVerificationCodes',
          'savedSearches',
          'savedWorksheets',
          'savedWorksheetSections',
        ])
          expect(tableNames).toContain(tableName);

        for (const indexName of [
          'app_users_verified_email_unique_idx',
          'email_verification_lookup_idx',
          'saved_searches_user_id_idx',
          'saved_worksheets_user_id_idx',
          'saved_worksheet_sections_unique_idx',
        ])
          expect(indexNames).toContain(indexName);

        expect(journal?.count).toBe(3);
      } finally {
        await client.end();
      }
    },
  );
});
