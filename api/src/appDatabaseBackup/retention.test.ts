import { describe, expect, it } from 'vitest';

import type { AppDatabaseBackupManifest } from './manifest.js';
import { selectBackupRetention } from './retention.js';

const namespace = 'staging/app-db/';

function manifest(backupTime: string, suffix = ''): AppDatabaseBackupManifest {
  const timestamp = backupTime.replaceAll(':', '-');
  const dumpKey = `${namespace}${timestamp}${suffix}.dump`;
  return {
    formatVersion: 1,
    backupTime,
    dumpKey,
    environment: 'staging',
    schemaVersion: '0002_wild_skaar',
    sha256: 'a'.repeat(64),
    size: 42,
    taskVersion: '1',
  };
}

describe('App DB backup retention', () => {
  it('keeps seven UTC dailies and four UTC weeklies', () => {
    const backups = [
      '2026-07-11T08:00:00.000Z',
      '2026-07-10T08:00:00.000Z',
      '2026-07-09T08:00:00.000Z',
      '2026-07-08T08:00:00.000Z',
      '2026-07-07T08:00:00.000Z',
      '2026-07-06T08:00:00.000Z',
      '2026-07-05T08:00:00.000Z',
      '2026-07-04T08:00:00.000Z',
      '2026-07-03T08:00:00.000Z',
      '2026-06-28T08:00:00.000Z',
      '2026-06-21T08:00:00.000Z',
      '2026-06-14T08:00:00.000Z',
      '2026-06-07T08:00:00.000Z',
    ].map((time) => manifest(time));

    const selected = selectBackupRetention(backups, namespace);

    expect(selected.retain.map(({ backupTime }) => backupTime)).toEqual([
      '2026-07-11T08:00:00.000Z',
      '2026-07-10T08:00:00.000Z',
      '2026-07-09T08:00:00.000Z',
      '2026-07-08T08:00:00.000Z',
      '2026-07-07T08:00:00.000Z',
      '2026-07-06T08:00:00.000Z',
      '2026-07-05T08:00:00.000Z',
      '2026-06-28T08:00:00.000Z',
      '2026-06-21T08:00:00.000Z',
    ]);
    expect(selected.remove.map(({ backupTime }) => backupTime)).toEqual([
      '2026-07-04T08:00:00.000Z',
      '2026-07-03T08:00:00.000Z',
      '2026-06-14T08:00:00.000Z',
      '2026-06-07T08:00:00.000Z',
    ]);
  });

  it('keeps only the newest backup for each daily and weekly slot', () => {
    const newest = manifest('2026-07-11T20:00:00.000Z', '-newest');
    const older = manifest('2026-07-11T08:00:00.000Z', '-older');

    const selected = selectBackupRetention([older, newest], namespace, {
      daily: 1,
      weekly: 1,
    });

    expect(selected.retain).toEqual([newest]);
    expect(selected.remove).toEqual([older]);
  });

  it('never selects an object outside the exact backup namespace for removal', () => {
    const inside = manifest('2026-07-11T08:00:00.000Z');
    const outside = {
      ...manifest('2026-06-01T08:00:00.000Z'),
      dumpKey: 'production/app-db/2026-06-01.dump',
    };

    const selected = selectBackupRetention([inside, outside], namespace, {
      daily: 0,
      weekly: 0,
    });

    expect(selected.remove).toEqual([inside]);
    expect(selected.retain).toEqual([]);
  });
});
