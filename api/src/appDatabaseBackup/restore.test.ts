import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { metadataForManifest } from './backup.js';
import type { AppDatabaseBackupStore } from './backupStore.js';
import type { AppDatabaseBackupManifest } from './manifest.js';
import { restoreAndVerifyAppDatabaseBackup } from './restore.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

const dump =
  'student@ucsd.edu postgresql://user:password@db.invalid/app row data';
const manifest: AppDatabaseBackupManifest = {
  formatVersion: 1,
  backupTime: '2026-07-11T08:00:00.000Z',
  dumpKey: 'staging/app-db/2026-07-11T08-00-00-000Z.dump',
  environment: 'staging',
  schemaVersion: '0002_wild_skaar',
  sha256: 'a5a9ab5095d27545c653627ec550a7ce600eee63a63933fba1adf9341fe43921',
  size: 67,
  taskVersion: '1',
};

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('App DB backup restore verification', () => {
  it('checks the downloaded dump before restore and reports schema and key-table evidence', async () => {
    const directory = await temporaryDirectory();
    const destination = path.join(directory, 'download.dump');
    const calls: string[] = [];
    const store = downloadStore(async (_key, downloadPath) => {
      await writeFile(downloadPath, dump);
      return {
        size: 67,
        metadata: metadataForManifest(manifest),
      };
    });

    const evidence = await restoreAndVerifyAppDatabaseBackup({
      destination,
      manifest,
      store,
      targetDatabaseUrl: 'postgresql://restore:secret@local.invalid/app',
      restoreDump(dumpPath, databaseUrl) {
        calls.push(`restore:${dumpPath}:${databaseUrl}`);
        return Promise.resolve();
      },
      verifyDatabase(databaseUrl, schemaVersion) {
        calls.push(`verify:${databaseUrl}:${schemaVersion}`);
        return Promise.resolve({
          keyTables: [
            'appUsers',
            'emailDeliveryAudits',
            'savedSearches',
            'savedWorksheets',
          ],
          schemaVersion,
        });
      },
    });

    expect(calls).toEqual([
      `restore:${destination}:postgresql://restore:secret@local.invalid/app`,
      'verify:postgresql://restore:secret@local.invalid/app:0002_wild_skaar',
    ]);
    expect(evidence).toEqual({
      backupDigest: 'sha256-pamrUJXSdUXGU2J-xVCnzmAO7mOmOTP7oa35NB_kOSE',
      backupTime: '2026-07-11T08:00:00.000Z',
      dumpKey: 'staging/app-db/2026-07-11T08-00-00-000Z.dump',
      environment: 'staging',
      keyTables: [
        'appUsers',
        'emailDeliveryAudits',
        'savedSearches',
        'savedWorksheets',
      ],
      schemaVersion: '0002_wild_skaar',
      size: 67,
      status: 'verified',
      taskVersion: '1',
    });
    expect(JSON.stringify(evidence)).not.toContain('student@ucsd.edu');
    expect(JSON.stringify(evidence)).not.toContain('secret');
    expect(() => assertGeneralTelemetrySafe(evidence)).not.toThrow();
  });

  it('does not restore a dump whose digest does not match its manifest', async () => {
    const directory = await temporaryDirectory();
    let restoreCalls = 0;
    const store = downloadStore(async (_key, downloadPath) => {
      await writeFile(downloadPath, 'tampered');
      return { size: 67, metadata: metadataForManifest(manifest) };
    });

    await expect(
      restoreAndVerifyAppDatabaseBackup({
        destination: path.join(directory, 'download.dump'),
        manifest,
        store,
        targetDatabaseUrl: 'postgresql://local.invalid/app',
        restoreDump() {
          restoreCalls += 1;
          return Promise.resolve();
        },
        verifyDatabase: () =>
          Promise.resolve({ keyTables: [], schemaVersion: '' }),
      }),
    ).rejects.toThrow('Downloaded App DB backup verification failed');
    expect(restoreCalls).toBe(0);
  });
});

function downloadStore(
  download: AppDatabaseBackupStore['downloadDump'],
): AppDatabaseBackupStore {
  return {
    putDump() {
      throw new Error('not used');
    },
    putManifest: () => Promise.resolve(),
    listManifests: () => Promise.resolve([manifest]),
    downloadDump: download,
    removeBackups: () => Promise.resolve(),
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'app-db-restore-'));
  temporaryDirectories.push(directory);
  return directory;
}
