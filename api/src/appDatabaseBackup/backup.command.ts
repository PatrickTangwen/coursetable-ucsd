import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';

import { publishAppDatabaseBackup } from './backup.js';
import { createPostgresCustomDump } from './postgresTools.js';
import { createHostedR2BackupRuntime, required } from './r2Runtime.js';
import { readAppDatabaseSchemaVersion } from '../../drizzle/migrationRunner.js';

const databaseUrl = required(process.env, 'NEON_DIRECT_DATABASE_URL');
const runtime = createHostedR2BackupRuntime(process.env);
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-app-db-backup-'),
);

try {
  const dumpPath = path.join(directory, 'app-db.dump');
  const schemaVersion = await currentSchemaVersion(databaseUrl);
  await createPostgresCustomDump(databaseUrl, dumpPath);
  const evidence = await publishAppDatabaseBackup({
    backupTime: new Date(),
    dumpPath,
    environment: runtime.deploymentEnvironment,
    namespace: runtime.namespace,
    schemaVersion,
    store: runtime.store,
    taskVersion: '1',
  });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch {
  throw new Error('App DB backup failed');
} finally {
  runtime.client.destroy();
  await rm(directory, { recursive: true, force: true });
}

async function currentSchemaVersion(url: string) {
  const client = postgres(url, { max: 1, onnotice() {} });
  try {
    return await readAppDatabaseSchemaVersion(client);
  } finally {
    await client.end();
  }
}
