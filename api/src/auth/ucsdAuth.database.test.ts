import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseUcsdAuthStore } from './ucsdAuth.database.js';
import { emailVerificationCodes } from '../../drizzle/schema.js';
import * as schema from '../../drizzle/schema.js';

const databaseUrl = process.env.APP_DB_MIGRATION_TEST_URL;
const execFileAsync = promisify(execFile);

describe.skipIf(!databaseUrl)('PostgreSQL verification reservation', () => {
  const client = postgres(databaseUrl ?? '', { max: 4 });
  const database = drizzle(client, { schema });
  const store = createDatabaseUcsdAuthStore(database);
  const email = `issue80-${Date.now()}@ucsd.edu`;
  const staleEmail = `issue80-stale-${Date.now()}@ucsd.edu`;

  beforeAll(async () => {
    await execFileAsync('bun', ['run', 'db:migrate'], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, DB_URL: databaseUrl },
    });
  });

  afterAll(async () => {
    await database
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.normalizedEmail, email));
    await database
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.normalizedEmail, staleEmail));
    await client.end();
  });

  it('serializes concurrent reservations and excludes failed delivery from cooldown', async () => {
    const record = {
      normalizedEmail: email,
      codeHash: 'hash-one',
      createdAt: 1_000_000,
      expiresAt: 1_900_000,
    };
    const [first, second] = await Promise.all([
      store.reserveVerification(record, 60_000),
      store.reserveVerification({ ...record, codeHash: 'hash-two' }, 60_000),
    ]);
    const created = first.status === 'created' ? first : second;
    const blocked = [first, second].find(
      (result) => result.status === 'blocked',
    );
    expect(created.status).toBe('created');
    expect(blocked).toMatchObject({ status: 'blocked', reason: 'pending' });
    if (created.status !== 'created') throw new Error('not created');

    await store.markVerificationFailed(created.verificationId);
    const retry = await store.reserveVerification(
      { ...record, codeHash: 'hash-three', createdAt: 1_000_001 },
      60_000,
    );
    expect(retry).toMatchObject({ status: 'created' });
    if (retry.status !== 'created') throw new Error('retry not created');

    await store.markVerificationSent(retry.verificationId);
    await expect(
      store.reserveVerification(
        { ...record, codeHash: 'hash-four', createdAt: 1_000_002 },
        60_000,
      ),
    ).resolves.toMatchObject({ status: 'blocked', reason: 'cooldown' });
  });

  it('keeps stale pending delivery unique and consumable until expiry', async () => {
    const pending = await store.reserveVerification(
      {
        normalizedEmail: staleEmail,
        codeHash: 'ambiguous-hash',
        createdAt: 1_000_000,
        expiresAt: 1_900_000,
      },
      60_000,
    );
    expect(pending.status).toBe('created');

    await expect(
      store.reserveVerification(
        {
          normalizedEmail: staleEmail,
          codeHash: 'replacement-hash',
          createdAt: 1_600_000,
          expiresAt: 2_500_000,
        },
        60_000,
      ),
    ).resolves.toMatchObject({ status: 'blocked', reason: 'pending' });
    await expect(
      store.consumeVerification(staleEmail, 'ambiguous-hash', 1_600_000),
    ).resolves.toBe('consumed');
  });
});
