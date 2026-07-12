import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';

import { publishAppDatabaseBackup } from './backup.js';
import { createFilesystemAppDatabaseBackupStore } from './filesystemBackupStore.js';
import {
  createPostgresCustomDump,
  restorePostgresCustomDump,
} from './postgresTools.js';
import { required } from './r2Runtime.js';
import { restoreAndVerifyAppDatabaseBackup } from './restore.js';
import { verifyRestoredAppDatabase } from './restoreVerifier.js';
import { readAppDatabaseSchemaVersion } from '../../drizzle/migrationRunner.js';

const sourceDatabaseUrl = required(process.env, 'APP_DB_BACKUP_SOURCE_URL');
const sourcePgUrl =
  process.env.APP_DB_BACKUP_PG_SOURCE_URL?.trim() ?? sourceDatabaseUrl;
const restoreDatabaseUrl = required(process.env, 'APP_DB_RESTORE_TEST_URL');
const restorePgUrl =
  process.env.APP_DB_RESTORE_PG_URL?.trim() ?? restoreDatabaseUrl;
const objectStoreDirectory = required(
  process.env,
  'APP_DB_BACKUP_LOCAL_DIRECTORY',
);
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-local-recovery-'),
);
let step = 'read-schema-version';

try {
  const schemaVersion = await currentSchemaVersion(sourceDatabaseUrl);
  const dumpPath = path.join(directory, 'source.dump');
  step = 'create-custom-dump';
  await createPostgresCustomDump(sourcePgUrl, dumpPath);
  const namespace = 'staging/app-db/';
  const store = createFilesystemAppDatabaseBackupStore(
    objectStoreDirectory,
    namespace,
  );
  step = 'publish-backup';
  const backup = await publishAppDatabaseBackup({
    backupTime: new Date('2026-07-11T08:00:00.000Z'),
    dumpPath,
    environment: 'staging',
    namespace,
    schemaVersion,
    store,
    taskVersion: '1',
  });
  const manifest = (await store.listManifests()).find(
    ({ dumpKey }) => dumpKey === backup.dumpKey,
  );
  if (!manifest) throw new Error('Local backup manifest is missing');
  step = 'restore-and-verify';
  const restore = await restoreAndVerifyAppDatabaseBackup({
    destination: path.join(directory, 'downloaded.dump'),
    manifest,
    store,
    targetDatabaseUrl: restorePgUrl,
    restoreDump: restorePostgresCustomDump,
    verifyDatabase: (_databaseUrl, version) =>
      verifyRestoredAppDatabase(restoreDatabaseUrl, version),
  });
  process.stdout.write(`${JSON.stringify({ backup, restore })}\n`);
} catch (error) {
  const reason = error instanceof Error ? error.message : 'unknown error';
  throw new Error(
    `Disposable App DB backup recovery failed at ${step}: ${reason}`,
    { cause: error },
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function currentSchemaVersion(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1, onnotice() {} });
  try {
    return await readAppDatabaseSchemaVersion(client);
  } finally {
    await client.end();
  }
}
