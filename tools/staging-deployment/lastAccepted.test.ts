import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  acceptedWorkerVersion,
  lastAcceptedExistsFilename,
  lastAcceptedFilename,
  putAndVerify,
  restoreCapturedLastAccepted,
} from './lastAccepted.js';

const encoder = new TextEncoder();

describe('last accepted deployment', () => {
  it('selects the durable accepted Worker version', () => {
    const body = encoder.encode(
      JSON.stringify({
        result: 'accepted',
        worker: { versionId: 'accepted-version' },
      }),
    );

    expect(acceptedWorkerVersion(body)).toBe('accepted-version');
  });

  it('verifies a remotely persisted evidence pointer by digest', async () => {
    const objects = new Map<string, Uint8Array>();
    const store = {
      get(key: string) {
        return Promise.resolve(objects.get(key) ?? null);
      },
      put(key: string, storedBody: Uint8Array) {
        objects.set(key, storedBody);
        return Promise.resolve();
      },
      delete(key: string) {
        objects.delete(key);
        return Promise.resolve();
      },
    };
    const body = encoder.encode('{"result":"accepted"}\n');

    await putAndVerify(store, 'deployment-evidence/last-accepted.json', body);

    expect(objects.get('deployment-evidence/last-accepted.json')).toBe(body);
  });

  it('restores the captured evidence pointer after a failed acceptance', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'last-accepted-'));
    const previous = encoder.encode(
      JSON.stringify({
        result: 'accepted',
        worker: { versionId: 'previous-version' },
      }),
    );
    const objects = new Map<string, Uint8Array>([
      ['deployment-evidence/last-accepted.json', encoder.encode('new')],
    ]);
    const store = {
      get(key: string) {
        return Promise.resolve(objects.get(key) ?? null);
      },
      put(key: string, body: Uint8Array) {
        objects.set(key, body);
        return Promise.resolve();
      },
      delete(key: string) {
        objects.delete(key);
        return Promise.resolve();
      },
    };
    try {
      await writeFile(path.join(directory, lastAcceptedFilename), previous);
      await writeFile(
        path.join(directory, lastAcceptedExistsFilename),
        'present\n',
      );

      await restoreCapturedLastAccepted(store, directory);

      expect(
        new TextDecoder().decode(
          objects.get('deployment-evidence/last-accepted.json'),
        ),
      ).toBe(new TextDecoder().decode(previous));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
