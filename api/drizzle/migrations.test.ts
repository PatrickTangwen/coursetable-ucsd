import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  './migrations/0000_romantic_king_bedlam.sql',
  import.meta.url,
);

describe('initial App DB migration', () => {
  it('contains the hosted login and saved-data schema', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "appUsers"');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS "emailVerificationCodes"',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "savedSearches"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "savedWorksheets"');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS "savedWorksheetSections"',
    );
    expect(sql).toContain('"app_users_verified_email_unique_idx"');
    expect(sql).toContain('"email_verification_lookup_idx"');
    expect(sql).toContain('"saved_searches_user_id_idx"');
    expect(sql).toContain('"saved_worksheets_user_id_idx"');
    expect(sql).toContain('"saved_worksheet_sections_unique_idx"');
  });
});
