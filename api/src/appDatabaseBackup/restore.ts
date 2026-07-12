import {
  digestBackupFile,
  metadataForManifest,
  sameStringRecord,
} from './backup.js';
import type { AppDatabaseBackupStore } from './backupStore.js';
import type { AppDatabaseBackupManifest } from './manifest.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

export async function restoreAndVerifyAppDatabaseBackup(input: {
  destination: string;
  manifest: AppDatabaseBackupManifest;
  store: AppDatabaseBackupStore;
  targetDatabaseUrl: string;
  restoreDump: (path: string, databaseUrl: string) => Promise<void>;
  verifyDatabase: (
    databaseUrl: string,
    schemaVersion: string,
  ) => Promise<{ keyTables: string[]; schemaVersion: string }>;
}) {
  const stored = await input.store.downloadDump(
    input.manifest.dumpKey,
    input.destination,
  );
  const expectedMetadata = metadataForManifest(input.manifest);
  const digest = await digestBackupFile(input.destination);
  if (
    stored.size !== input.manifest.size ||
    digest !== input.manifest.sha256 ||
    !sameStringRecord(stored.metadata, expectedMetadata)
  )
    throw new Error('Downloaded App DB backup verification failed');

  await input.restoreDump(input.destination, input.targetDatabaseUrl);
  const verified = await input.verifyDatabase(
    input.targetDatabaseUrl,
    input.manifest.schemaVersion,
  );
  if (verified.schemaVersion !== input.manifest.schemaVersion)
    throw new Error('Restored App DB schema version does not match its backup');

  const evidence = {
    backupDigest: `sha256-${Buffer.from(digest, 'hex').toString('base64url')}`,
    backupTime: input.manifest.backupTime,
    dumpKey: input.manifest.dumpKey,
    environment: input.manifest.environment,
    keyTables: verified.keyTables,
    schemaVersion: verified.schemaVersion,
    size: input.manifest.size,
    status: 'verified',
    taskVersion: input.manifest.taskVersion,
  };
  assertGeneralTelemetrySafe(evidence);
  return evidence;
}
