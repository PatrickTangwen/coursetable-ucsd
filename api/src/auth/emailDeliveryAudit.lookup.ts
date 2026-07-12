import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { createDatabaseEmailDeliveryAuditStore } from './emailDeliveryAudit.database.js';
import { normalizeVerifiedUcsdEmail } from './ucsdIdentity.js';
import * as schema from '../../drizzle/schema.js';

async function readRecipient() {
  process.stdin.setEncoding('utf8');
  let recipient = '';
  for await (const chunk of process.stdin) recipient += String(chunk);
  return recipient.trim();
}

async function main() {
  const databaseUrl = process.env.NEON_DIRECT_DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_DIRECT_DATABASE_URL is required');
  const normalizedRecipientEmail = normalizeVerifiedUcsdEmail(
    await readRecipient(),
  );
  if (!normalizedRecipientEmail)
    throw new Error('A direct UCSD recipient email is required on stdin');

  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });
  try {
    const audit = createDatabaseEmailDeliveryAuditStore(database);
    const records = await audit.findRecentByRecipient(
      normalizedRecipientEmail,
      Date.now(),
    );
    process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  main().catch(() => {
    process.stderr.write('Email Delivery Audit lookup failed\n');
    process.exitCode = 1;
  });
}
