import {
  digestBackupFile,
  metadataForManifest,
  sameStringRecord,
} from './backup.js';
import type { AppDatabaseBackupStore } from './backupStore.js';
import type { AppDatabaseBackupManifest } from './manifest.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

export interface AppDatabaseRestoreTarget {
  destination: string;
  manifest: AppDatabaseBackupManifest;
  targetDatabaseUrl: string;
}

export interface AppDatabaseRestoreCollaborators {
  store: AppDatabaseBackupStore;
  restoreDump: (path: string, databaseUrl: string) => Promise<void>;
  verifyDatabase: (
    databaseUrl: string,
    schemaVersion: string,
  ) => Promise<{ keyTables: string[]; schemaVersion: string }>;
}

export async function restoreAndVerifyAppDatabaseBackup(
  target: AppDatabaseRestoreTarget,
  collaborators: AppDatabaseRestoreCollaborators,
) {
  const stored = await collaborators.store.downloadDump(
    target.manifest.dumpKey,
    target.destination,
  );
  const expectedMetadata = metadataForManifest(target.manifest);
  const digest = await digestBackupFile(target.destination);
  if (
    stored.size !== target.manifest.size ||
    digest !== target.manifest.sha256 ||
    !sameStringRecord(stored.metadata, expectedMetadata)
  )
    throw new Error('Downloaded App DB backup verification failed');

  await collaborators.restoreDump(target.destination, target.targetDatabaseUrl);
  const verified = await collaborators.verifyDatabase(
    target.targetDatabaseUrl,
    target.manifest.schemaVersion,
  );
  if (verified.schemaVersion !== target.manifest.schemaVersion)
    throw new Error('Restored App DB schema version does not match its backup');

  const evidence = {
    backupDigest: `sha256-${Buffer.from(digest, 'hex').toString('base64url')}`,
    backupTime: target.manifest.backupTime,
    dumpKey: target.manifest.dumpKey,
    environment: target.manifest.environment,
    keyTables: verified.keyTables,
    schemaVersion: verified.schemaVersion,
    size: target.manifest.size,
    status: 'verified',
    taskVersion: target.manifest.taskVersion,
  };
  assertGeneralTelemetrySafe(evidence);
  return evidence;
}
