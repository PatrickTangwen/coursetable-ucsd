import { describe, expect, it } from 'vitest';

import {
  assertSameDatabaseTarget,
  backupRoleGrantStatements,
} from './backupRole.js';

describe('App DB backup role grants', () => {
  it('covers current and future public and migration objects', () => {
    expect(backupRoleGrantStatements('sungrid_backup')).toEqual([
      'GRANT USAGE ON SCHEMA public, drizzle TO "sungrid_backup"',
      'GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO "sungrid_backup"',
      'GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO "sungrid_backup"',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "sungrid_backup"',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO "sungrid_backup"',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON TABLES TO "sungrid_backup"',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON SEQUENCES TO "sungrid_backup"',
    ]);
  });

  it('quotes role identifiers instead of treating them as SQL', () => {
    const statements = backupRoleGrantStatements('backup"; select secret');

    expect(
      statements.every((statement) =>
        statement.endsWith('"backup""; select secret"'),
      ),
    ).toBe(true);
  });

  it('rejects cross-endpoint or cross-database grants before connecting', () => {
    expect(() =>
      assertSameDatabaseTarget(
        'postgresql://backup:secret@one.invalid/app',
        'postgresql://migration:secret@two.invalid/app',
      ),
    ).toThrow('App DB backup and migration targets do not match');
    expect(() =>
      assertSameDatabaseTarget(
        'postgresql://backup:secret@one.invalid/app',
        'postgresql://migration:secret@one.invalid/other',
      ),
    ).toThrow('App DB backup and migration targets do not match');
    expect(() =>
      assertSameDatabaseTarget(
        'postgresql://backup:secret@one.invalid/app',
        'postgresql://migration:secret@one.invalid/app',
      ),
    ).not.toThrow();
  });
});
