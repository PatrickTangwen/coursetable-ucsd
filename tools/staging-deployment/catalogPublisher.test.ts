import { describe, expect, it } from 'vitest';

import { publishCatalogArchive } from './catalogPublisher.js';

class MemoryStore {
  readonly objects = new Map<string, Uint8Array>();
  corruptKey: string | null = null;

  get(key: string) {
    const body = this.objects.get(key);
    if (!body) return Promise.resolve(null);
    if (key === this.corruptKey) return Promise.resolve(new Uint8Array([0]));
    return Promise.resolve(body);
  }

  put(key: string, body: Uint8Array) {
    this.objects.set(key, body);
    return Promise.resolve();
  }

  delete(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

const encoder = new TextEncoder();

describe('staging Catalog publisher', () => {
  it('preserves the accepted metadata pointer when object verification fails', async () => {
    const store = new MemoryStore();
    const previous = encoder.encode('{"deployment":"accepted"}\n');
    store.objects.set('metadata.json', previous);
    store.corruptKey =
      'published-snapshots/FA26/b1b367dc6a7d077581f77f16169a6696bac3d68ffd5c93189ac60fac027e57a3.json';

    await expect(
      publishCatalogArchive(
        {
          registry: {
            last_update: '2026-07-12T00:00:00.000Z',
            terms: [],
          },
          terms: [
            {
              term: 'FA26',
              snapshot: {
                body: encoder.encode('{"accepted":true}\n'),
                sha256:
                  'b1b367dc6a7d077581f77f16169a6696bac3d68ffd5c93189ac60fac027e57a3',
              },
              manifest: {
                body: encoder.encode('{"manifest":true}\n'),
                sha256:
                  'b52ab259c8b9dab5683cbd68defa991ac03d5e92851ab811f23129fe4833d2b9',
              },
            },
          ],
        },
        store,
      ),
    ).rejects.toThrow('Published Snapshot remote digest mismatch');

    expect(store.objects.get('metadata.json')).toBe(previous);
  });
});
