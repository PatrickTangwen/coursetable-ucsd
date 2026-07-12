import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getRequiredEnvironmentVariable } from './environment.js';
import { restorePostgresCustomDump } from './postgresTools.js';
import { createHostedR2BackupRuntime } from './r2Runtime.js';
import { restoreAndVerifyAppDatabaseBackup } from './restore.js';
import { verifyRestoredAppDatabase } from './restoreVerifier.js';

const targetDatabaseUrl = getRequiredEnvironmentVariable(
  process.env,
  'APP_DB_RESTORE_TEST_URL',
);
const restorePgUrl =
  process.env.APP_DB_RESTORE_PG_URL?.trim() ?? targetDatabaseUrl;
const backupKey = getRequiredEnvironmentVariable(
  process.env,
  'APP_DB_BACKUP_KEY',
);
const runtime = createHostedR2BackupRuntime(process.env);
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-app-db-restore-'),
);

try {
  const manifests = await runtime.store.listManifests();
  const manifest = manifests.find(({ dumpKey }) => dumpKey === backupKey);
  if (!manifest) throw new Error('Requested App DB backup was not found');
  const evidence = await restoreAndVerifyAppDatabaseBackup(
    {
      destination: path.join(directory, 'app-db.dump'),
      manifest,
      targetDatabaseUrl: restorePgUrl,
    },
    {
      store: runtime.store,
      restoreDump: restorePostgresCustomDump,
      verifyDatabase: (_databaseUrl, schemaVersion) =>
        verifyRestoredAppDatabase(targetDatabaseUrl, schemaVersion),
    },
  );
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch {
  throw new Error('App DB restore verification failed');
} finally {
  runtime.client.destroy();
  await rm(directory, { recursive: true, force: true });
}
