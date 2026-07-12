import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { publishAppDatabaseBackup } from './backup.js';
import type {
  AppDatabaseBackupStore,
  StoredBackupDump,
} from './backupStore.js';
import type { AppDatabaseBackupManifest } from './manifest.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('App DB backup publication', () => {
  it('publishes an accepted manifest, applies retention, and emits only non-sensitive evidence', async () => {
    const dump =
      'student@ucsd.edu postgresql://user:password@db.invalid/app row data';
    const directory = await temporaryDirectory();
    const dumpPath = path.join(directory, 'database.dump');
    await writeFile(dumpPath, dump);
    const published: AppDatabaseBackupManifest[] = [];
    const removed: AppDatabaseBackupManifest[] = [];
    let uploaded:
      | { key: string; path: string; metadata: { [key: string]: string } }
      | undefined = undefined;
    const old = manifest('2026-07-01T08:00:00.000Z');
    const store: AppDatabaseBackupStore = {
      putDump(input) {
        uploaded = input;
        return Promise.resolve({ size: 67, metadata: input.metadata });
      },
      putManifest(value) {
        published.push(value);
        return Promise.resolve();
      },
      listManifests() {
        return Promise.resolve([...published, old]);
      },
      downloadDump() {
        throw new Error('not used');
      },
      removeBackups(values) {
        removed.push(...values);
        return Promise.resolve();
      },
    };

    const evidence = await publishAppDatabaseBackup({
      backupTime: new Date('2026-07-11T08:00:00.000Z'),
      dumpPath,
      environment: 'staging',
      namespace: 'staging/app-db/',
      schemaVersion: '0002_wild_skaar',
      store,
      taskVersion: '1',
      retention: { daily: 1, weekly: 0 },
    });

    expect(uploaded).toMatchObject({
      key: 'staging/app-db/2026-07-11T08-00-00-000Z.dump',
      path: dumpPath,
      metadata: {
        'backup-time': '2026-07-11T08:00:00.000Z',
        environment: 'staging',
        'schema-version': '0002_wild_skaar',
        sha256:
          'a5a9ab5095d27545c653627ec550a7ce600eee63a63933fba1adf9341fe43921',
        size: '67',
        'task-version': '1',
      },
    });
    expect(published).toHaveLength(1);
    expect(removed).toEqual([old]);
    expect(evidence).toEqual({
      backupDigest: 'sha256-pamrUJXSdUXGU2J-xVCnzmAO7mOmOTP7oa35NB_kOSE',
      backupTime: '2026-07-11T08:00:00.000Z',
      dumpKey: 'staging/app-db/2026-07-11T08-00-00-000Z.dump',
      environment: 'staging',
      removedBackups: 1,
      retainedBackups: 1,
      schemaVersion: '0002_wild_skaar',
      size: 67,
      taskVersion: '1',
    });
    expect(JSON.stringify(evidence)).not.toContain('student@ucsd.edu');
    expect(JSON.stringify(evidence)).not.toContain('password');
    expect(() => assertGeneralTelemetrySafe(evidence)).not.toThrow();
  });

  it('does not accept a manifest when stored size or metadata differs', async () => {
    const directory = await temporaryDirectory();
    const dumpPath = path.join(directory, 'database.dump');
    await writeFile(dumpPath, 'dump');
    let manifestWrites = 0;
    const store = failingStore({ size: 3, metadata: {} }, () => {
      manifestWrites += 1;
    });

    await expect(
      publishAppDatabaseBackup({
        backupTime: new Date('2026-07-11T08:00:00.000Z'),
        dumpPath,
        environment: 'staging',
        namespace: 'staging/app-db/',
        schemaVersion: '0002_wild_skaar',
        store,
        taskVersion: '1',
      }),
    ).rejects.toThrow('R2 backup verification failed');
    expect(manifestWrites).toBe(0);
  });
});

function manifest(backupTime: string): AppDatabaseBackupManifest {
  return {
    formatVersion: 1,
    backupTime,
    dumpKey: `staging/app-db/${backupTime.replaceAll(':', '-')}.dump`,
    environment: 'staging',
    schemaVersion: '0002_wild_skaar',
    sha256: 'b'.repeat(64),
    size: 10,
    taskVersion: '1',
  };
}

function failingStore(
  stored: StoredBackupDump,
  manifestWritten: () => void,
): AppDatabaseBackupStore {
  return {
    putDump: () => Promise.resolve(stored),
    putManifest() {
      manifestWritten();
      return Promise.resolve();
    },
    listManifests: () => Promise.resolve([]),
    downloadDump: () => Promise.resolve(stored),
    removeBackups: () => Promise.resolve(),
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'app-db-backup-'));
  temporaryDirectories.push(directory);
  return directory;
}
