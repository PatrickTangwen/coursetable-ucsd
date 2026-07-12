import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { publishAppDatabaseBackup } from './backup.js';
import { getRequiredEnvironmentVariable } from './environment.js';
import { createSchemaConsistentDump } from './postgresTools.js';
import { createHostedR2BackupRuntime } from './r2Runtime.js';

const databaseUrl = getRequiredEnvironmentVariable(
  process.env,
  'NEON_DIRECT_DATABASE_URL',
);
const runtime = createHostedR2BackupRuntime(process.env);
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-app-db-backup-'),
);

try {
  const dumpPath = path.join(directory, 'app-db.dump');
  const schemaVersion = await createSchemaConsistentDump(
    { schemaDatabaseUrl: databaseUrl, dumpDatabaseUrl: databaseUrl },
    dumpPath,
  );
  const evidence = await publishAppDatabaseBackup(
    {
      backupTime: new Date(),
      dumpPath,
      environment: runtime.deploymentEnvironment,
      namespace: runtime.namespace,
      schemaVersion,
      taskVersion: '1',
    },
    runtime.store,
  );
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch {
  throw new Error('App DB backup failed');
} finally {
  runtime.client.destroy();
  await rm(directory, { recursive: true, force: true });
}
