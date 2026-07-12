import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import type { AppDatabaseBackupStore } from './backupStore.js';
import {
  appDatabaseBackupManifestSchema,
  type AppDatabaseBackupManifest,
} from './manifest.js';
import { selectBackupRetention } from './retention.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

export interface AppDatabaseBackupArtifact {
  backupTime: Date;
  dumpPath: string;
  environment: 'staging' | 'production';
  namespace: string;
  schemaVersion: string;
  taskVersion: string;
}

export async function publishAppDatabaseBackup(
  artifact: AppDatabaseBackupArtifact,
  store: AppDatabaseBackupStore,
  retentionLimits = { daily: 7, weekly: 4 },
) {
  const backupTime = artifact.backupTime.toISOString();
  const { size } = await stat(artifact.dumpPath);
  const sha256 = await digestBackupFile(artifact.dumpPath);
  const dumpKey = `${artifact.namespace}${backupTime.replaceAll(/[:.]/gu, '-')}.dump`;
  const manifest = appDatabaseBackupManifestSchema.parse({
    formatVersion: 1,
    backupTime,
    dumpKey,
    environment: artifact.environment,
    schemaVersion: artifact.schemaVersion,
    sha256,
    size,
    taskVersion: artifact.taskVersion,
  });
  const metadata = metadataForManifest(manifest);

  try {
    const stored = await store.putDump({
      key: dumpKey,
      path: artifact.dumpPath,
      metadata,
    });
    if (stored.size !== size || !sameStringRecord(stored.metadata, metadata))
      throw new Error('R2 backup verification failed');

    await store.putManifest(manifest);
  } catch (error) {
    try {
      await store.removeBackups([manifest]);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'R2 backup publication and cleanup failed',
        { cause: cleanupError },
      );
    }
    throw error;
  }
  const manifests = await store.listManifests();
  if (!manifests.some((candidate) => candidate.dumpKey === dumpKey))
    throw new Error('R2 backup manifest verification failed');
  const retention = selectBackupRetention(
    manifests,
    artifact.namespace,
    retentionLimits,
  );
  await store.removeBackups(retention.remove);

  const evidence = {
    backupDigest: `sha256-${Buffer.from(sha256, 'hex').toString('base64url')}`,
    backupTime,
    dumpKey,
    environment: artifact.environment,
    removedBackups: retention.remove.length,
    retainedBackups: retention.retain.length,
    schemaVersion: artifact.schemaVersion,
    size,
    taskVersion: artifact.taskVersion,
  };
  assertGeneralTelemetrySafe(evidence);
  return evidence;
}

export function metadataForManifest(manifest: AppDatabaseBackupManifest) {
  return {
    'backup-time': manifest.backupTime,
    environment: manifest.environment,
    'schema-version': manifest.schemaVersion,
    sha256: manifest.sha256,
    size: String(manifest.size),
    'task-version': manifest.taskVersion,
  };
}

export async function digestBackupFile(path: string) {
  const digest = crypto.createHash('sha256');
  const stream = createReadStream(path) as AsyncIterable<Buffer>;
  for await (const chunk of stream) digest.update(chunk);
  return digest.digest('hex');
}

export function sameStringRecord(
  left: { [key: string]: string },
  right: { [key: string]: string },
) {
  const leftEntries = Object.entries(left).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(right).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}
