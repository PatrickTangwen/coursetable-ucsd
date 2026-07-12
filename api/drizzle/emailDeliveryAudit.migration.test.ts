import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { emailDeliveryAuditRecordFields } from '../src/auth/emailDeliveryAudit.store.js';

const migrationsDirectory = new URL('./migrations/', import.meta.url);

describe('Email Delivery Audit migration', () => {
  it('creates an App DB table with exactly the six allowed record columns', async () => {
    const files = (await readdir(migrationsDirectory)).filter((file) =>
      file.endsWith('.sql'),
    );
    const migrations = await Promise.all(
      files.map((file) =>
        readFile(
          new URL(path.posix.join('./migrations/', file), import.meta.url),
          'utf8',
        ),
      ),
    );
    const sql = migrations.join('\n');
    const tableStart = sql.indexOf(
      'CREATE TABLE IF NOT EXISTS "emailDeliveryAudits" (',
    );
    const tableEnd = sql.indexOf('\n);', tableStart);
    const table =
      tableStart === -1 || tableEnd === -1
        ? undefined
        : sql.slice(tableStart, tableEnd);

    expect(table).toBeDefined();
    const columns = (table ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('"'))
      .map((line) => line.slice(1, line.indexOf('"', 1)));
    expect(columns.sort((a, b) => a.localeCompare(b))).toEqual(
      [...emailDeliveryAuditRecordFields].sort((a, b) => a.localeCompare(b)),
    );
    expect(sql).toContain('"email_delivery_audit_recipient_time_idx"');
    expect(sql).toContain('"email_delivery_audit_expiry_idx"');
  });
});
