import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { publishAppDatabaseBackup } from './backup.js';
import { getRequiredEnvironmentVariable } from './environment.js';
import { createFilesystemAppDatabaseBackupStore } from './filesystemBackupStore.js';
import {
  createSchemaConsistentDump,
  restorePostgresCustomDump,
} from './postgresTools.js';
import { restoreAndVerifyAppDatabaseBackup } from './restore.js';
import { verifyRestoredAppDatabase } from './restoreVerifier.js';

const sourceDatabaseUrl = getRequiredEnvironmentVariable(
  process.env,
  'APP_DB_BACKUP_SOURCE_URL',
);
const sourcePgUrl =
  process.env.APP_DB_BACKUP_PG_SOURCE_URL?.trim() ?? sourceDatabaseUrl;
const restoreDatabaseUrl = getRequiredEnvironmentVariable(
  process.env,
  'APP_DB_RESTORE_TEST_URL',
);
const restorePgUrl =
  process.env.APP_DB_RESTORE_PG_URL?.trim() ?? restoreDatabaseUrl;
const objectStoreDirectory = getRequiredEnvironmentVariable(
  process.env,
  'APP_DB_BACKUP_LOCAL_DIRECTORY',
);
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-local-recovery-'),
);
let step = 'read-schema-version';

try {
  const dumpPath = path.join(directory, 'source.dump');
  step = 'create-custom-dump';
  const schemaVersion = await createSchemaConsistentDump(
    {
      schemaDatabaseUrl: sourceDatabaseUrl,
      dumpDatabaseUrl: sourcePgUrl,
    },
    dumpPath,
  );
  const namespace = 'staging/app-db/';
  const store = createFilesystemAppDatabaseBackupStore(
    objectStoreDirectory,
    namespace,
  );
  step = 'publish-backup';
  const backup = await publishAppDatabaseBackup(
    {
      backupTime: new Date('2026-07-11T08:00:00.000Z'),
      dumpPath,
      environment: 'staging',
      namespace,
      schemaVersion,
      taskVersion: '1',
    },
    store,
  );
  const manifest = (await store.listManifests()).find(
    ({ dumpKey }) => dumpKey === backup.dumpKey,
  );
  if (!manifest) throw new Error('Local backup manifest is missing');
  step = 'restore-and-verify';
  const restore = await restoreAndVerifyAppDatabaseBackup(
    {
      destination: path.join(directory, 'downloaded.dump'),
      manifest,
      targetDatabaseUrl: restorePgUrl,
    },
    {
      store,
      restoreDump: restorePostgresCustomDump,
      verifyDatabase: (_databaseUrl, version) =>
        verifyRestoredAppDatabase(restoreDatabaseUrl, version),
    },
  );
  process.stdout.write(`${JSON.stringify({ backup, restore })}\n`);
} catch {
  throw new Error(`Disposable App DB backup recovery failed at ${step}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
