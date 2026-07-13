import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { publishAppDatabaseBackup } from './backup.js';
import { getRequiredEnvironmentVariable } from './environment.js';
import {
  appDatabaseBackupFailureEvidence,
  type AppDatabaseBackupStage,
} from './failureEvidence.js';
import { createSchemaConsistentDump } from './postgresTools.js';
import { createHostedR2BackupRuntime } from './r2Runtime.js';

let stage: AppDatabaseBackupStage = 'initialize';
let runtime: ReturnType<typeof createHostedR2BackupRuntime> | undefined =
  undefined;
let directory: string | undefined = undefined;

try {
  const databaseUrl = getRequiredEnvironmentVariable(
    process.env,
    'NEON_DIRECT_DATABASE_URL',
  );
  runtime = createHostedR2BackupRuntime(process.env);
  directory = await mkdtemp(path.join(os.tmpdir(), 'sungrid-app-db-backup-'));
  const dumpPath = path.join(directory, 'app-db.dump');
  stage = 'create-dump';
  const schemaVersion = await createSchemaConsistentDump(
    { schemaDatabaseUrl: databaseUrl, dumpDatabaseUrl: databaseUrl },
    dumpPath,
  );
  stage = 'publish-backup';
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
  process.stderr.write(
    `${JSON.stringify(appDatabaseBackupFailureEvidence(stage))}\n`,
  );
  throw new Error('App DB backup failed');
} finally {
  runtime?.client.destroy();
  if (directory) await rm(directory, { recursive: true, force: true });
}
