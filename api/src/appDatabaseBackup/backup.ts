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

export async function publishAppDatabaseBackup(input: {
  backupTime: Date;
  dumpPath: string;
  environment: 'staging' | 'production';
  namespace: string;
  schemaVersion: string;
  store: AppDatabaseBackupStore;
  taskVersion: string;
  retention?: { daily: number; weekly: number };
}) {
  const backupTime = input.backupTime.toISOString();
  const { size } = await stat(input.dumpPath);
  const sha256 = await digestBackupFile(input.dumpPath);
  const dumpKey = `${input.namespace}${backupTime.replaceAll(/[:.]/gu, '-')}.dump`;
  const manifest = appDatabaseBackupManifestSchema.parse({
    formatVersion: 1,
    backupTime,
    dumpKey,
    environment: input.environment,
    schemaVersion: input.schemaVersion,
    sha256,
    size,
    taskVersion: input.taskVersion,
  });
  const metadata = metadataForManifest(manifest);

  const stored = await input.store.putDump({
    key: dumpKey,
    path: input.dumpPath,
    metadata,
  });
  if (stored.size !== size || !sameStringRecord(stored.metadata, metadata))
    throw new Error('R2 backup verification failed');

  await input.store.putManifest(manifest);
  const manifests = await input.store.listManifests();
  if (!manifests.some((candidate) => candidate.dumpKey === dumpKey))
    throw new Error('R2 backup manifest verification failed');
  const retention = selectBackupRetention(
    manifests,
    input.namespace,
    input.retention,
  );
  await input.store.removeBackups(retention.remove);

  const evidence = {
    backupDigest: `sha256-${Buffer.from(sha256, 'hex').toString('base64url')}`,
    backupTime,
    dumpKey,
    environment: input.environment,
    removedBackups: retention.remove.length,
    retainedBackups: retention.retain.length,
    schemaVersion: input.schemaVersion,
    size,
    taskVersion: input.taskVersion,
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
