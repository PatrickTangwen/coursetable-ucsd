import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it } from 'vitest';

import type { AppDatabaseBackupManifest } from './manifest.js';
import { createR2AppDatabaseBackupStore } from './r2BackupStore.js';

const namespace = 'staging/app-db/';
const dumpKey = `${namespace}2026-07-11T08-00-00-000Z.dump`;
const manifest: AppDatabaseBackupManifest = {
  formatVersion: 1,
  backupTime: '2026-07-11T08:00:00.000Z',
  dumpKey,
  environment: 'staging',
  schemaVersion: '0002_wild_skaar',
  sha256: 'a'.repeat(64),
  size: 4,
  taskVersion: '1',
};
const metadata = {
  'backup-time': manifest.backupTime,
  environment: manifest.environment,
  'schema-version': manifest.schemaVersion,
  sha256: manifest.sha256,
  size: String(manifest.size),
  'task-version': manifest.taskVersion,
};

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('private R2 App DB backup store', () => {
  it('uploads a dump with required private object metadata and verifies it', async () => {
    const commands: unknown[] = [];
    const client = {
      send(command: unknown) {
        commands.push(command);
        if (command instanceof HeadObjectCommand)
          return Promise.resolve({ ContentLength: 4, Metadata: metadata });
        return Promise.resolve({});
      },
    };
    const directory = await temporaryDirectory();
    const dumpPath = path.join(directory, 'backup.dump');
    await writeFile(dumpPath, 'dump');
    const store = createR2AppDatabaseBackupStore(
      client as never,
      'private-backups',
      namespace,
    );

    const stored = await store.putDump({
      key: dumpKey,
      path: dumpPath,
      metadata,
    });

    expect(stored).toEqual({ size: 4, metadata });
    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: 'private-backups',
      Key: dumpKey,
      ContentType: 'application/vnd.postgresql.custom-dump',
      Metadata: metadata,
    });
    expect(commands[1]).toBeInstanceOf(HeadObjectCommand);
  });

  it('lists accepted manifests and downloads their dump', async () => {
    const client = {
      send(command: unknown) {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [
              { Key: `${namespace}2026-07-11T08-00-00-000Z.manifest.json` },
              { Key: `${namespace}ignored.partial` },
            ],
            IsTruncated: false,
          });
        }
        if (command instanceof GetObjectCommand) {
          if (command.input.Key?.endsWith('.manifest.json')) {
            return Promise.resolve({
              Body: Readable.from([JSON.stringify(manifest)]),
            });
          }
          return Promise.resolve({
            Body: Readable.from(['dump']),
            ContentLength: 4,
            Metadata: metadata,
          });
        }
        return Promise.resolve({});
      },
    };
    const directory = await temporaryDirectory();
    const destination = path.join(directory, 'restored.dump');
    const store = createR2AppDatabaseBackupStore(
      client as never,
      'private-backups',
      namespace,
    );

    expect(await store.listManifests()).toEqual([manifest]);
    expect(await store.downloadDump(dumpKey, destination)).toEqual({
      size: 4,
      metadata,
    });
    expect(await readFile(destination, 'utf8')).toBe('dump');
  });

  it('deletes only complete bundles inside its configured namespace', async () => {
    const commands: unknown[] = [];
    const client = {
      send(command: unknown) {
        commands.push(command);
        return Promise.resolve({});
      },
    };
    const store = createR2AppDatabaseBackupStore(
      client as never,
      'private-backups',
      namespace,
    );

    await store.removeBackups([manifest]);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(DeleteObjectsCommand);
    expect((commands[0] as DeleteObjectsCommand).input.Delete?.Objects).toEqual(
      [
        { Key: dumpKey },
        { Key: `${namespace}2026-07-11T08-00-00-000Z.manifest.json` },
      ],
    );

    await expect(
      store.removeBackups([
        { ...manifest, dumpKey: 'production/app-db/never-delete.dump' },
      ]),
    ).rejects.toThrow('outside the configured backup namespace');
    expect(commands).toHaveLength(1);
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'app-db-backup-'));
  temporaryDirectories.push(directory);
  return directory;
}
