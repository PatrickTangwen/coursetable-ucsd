import { describe, expect, it } from 'vitest';

import { publishTermArchive } from './termArchivePublisher.js';

class MemoryStore {
  readonly objects = new Map<string, Uint8Array>();
  corruptKey: string | null = null;

  get(key: string): Promise<Uint8Array | null> {
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

class ConcurrencyTrackingStore extends MemoryStore {
  activeGets = 0;
  maxActiveGets = 0;

  override async get(key: string) {
    this.activeGets += 1;
    this.maxActiveGets = Math.max(this.maxActiveGets, this.activeGets);
    try {
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      return await super.get(key);
    } finally {
      this.activeGets -= 1;
    }
  }
}

const encoder = new TextEncoder();

describe('staging Term Archive publisher', () => {
  it('reports privacy-safe term and metadata progress', async () => {
    const store = new MemoryStore();
    const progress: string[] = [];
    const snapshot = encoder.encode('{"accepted":true}\n');
    const details = encoder.encode('{"details":true}\n');
    const manifest = encoder.encode('{"manifest":true}\n');

    await publishTermArchive(
      {
        registry: {
          last_update: '2026-07-17T00:00:00.000Z',
          terms: [],
        },
        terms: [
          {
            term: 'FA26',
            snapshot: {
              body: snapshot,
              sha256:
                'b1b367dc6a7d077581f77f16169a6696bac3d68ffd5c93189ac60fac027e57a3',
            },
            details: {
              body: details,
              sha256:
                '3f3b714342310f987623675a421a116d8e5642be7e3713fe98ce18ed810259e2',
            },
            manifest: {
              body: manifest,
              sha256:
                'b52ab259c8b9dab5683cbd68defa991ac03d5e92851ab811f23129fe4833d2b9',
            },
          },
        ],
      },
      store,
      (event) => progress.push(event),
    );

    expect(progress.map((event) => JSON.parse(event) as unknown)).toEqual([
      { operation: 'term-archive-publish', phase: 'term-start', term: 'FA26' },
      {
        operation: 'term-archive-publish',
        phase: 'term-complete',
        term: 'FA26',
      },
      { operation: 'term-archive-publish', phase: 'registry-verify-start' },
      { operation: 'term-archive-publish', phase: 'registry-verify-complete' },
      { operation: 'term-archive-publish', phase: 'metadata-start' },
      { operation: 'term-archive-publish', phase: 'metadata-complete' },
    ]);
    expect(progress.join('\n')).not.toContain('accepted');
    expect(progress.join('\n')).not.toContain('manifest');
    expect(
      store.objects.get(
        'published-details/FA26/3f3b714342310f987623675a421a116d8e5642be7e3713fe98ce18ed810259e2.json',
      ),
    ).toEqual(details);
  });

  it('preserves the accepted metadata pointer when object verification fails', async () => {
    const store = new MemoryStore();
    const previous = encoder.encode('{"deployment":"accepted"}\n');
    store.objects.set('metadata.json', previous);
    store.corruptKey =
      'published-snapshots/FA26/b1b367dc6a7d077581f77f16169a6696bac3d68ffd5c93189ac60fac027e57a3.json';

    await expect(
      publishTermArchive(
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
              details: {
                body: encoder.encode('{"details":true}\n'),
                sha256:
                  '3f3b714342310f987623675a421a116d8e5642be7e3713fe98ce18ed810259e2',
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

  it('verifies and reports durable Frozen Snapshot objects', async () => {
    const store = new MemoryStore();
    const snapshot = encoder.encode('{"frozen":true}\n');
    const manifest = encoder.encode('{"manifest":true}\n');
    const snapshotDigest =
      'ff9f1f7bf5c634879f9ff3c4bd3bf42d40973c7846eb8734d5ae6ad47c744497';
    const manifestDigest =
      'b52ab259c8b9dab5683cbd68defa991ac03d5e92851ab811f23129fe4833d2b9';
    store.objects.set(
      `published-snapshots/FA24/${snapshotDigest}.json`,
      snapshot,
    );
    store.objects.set(
      `published-manifests/FA24/${manifestDigest}.json`,
      manifest,
    );

    const evidence = await publishTermArchive(
      {
        registry: {
          last_update: '2026-07-12T00:00:00.000Z',
          terms: [
            {
              term: 'FA24',
              label: 'Fall 2024',
              date_range: null,
              frozen: true,
              generated_at: '2025-01-01T00:00:00.000Z',
              snapshot_path: `published-snapshots/FA24/${snapshotDigest}.json`,
              detail_path: null,
              manifest_path: `published-manifests/FA24/${manifestDigest}.json`,
            },
          ],
        },
        terms: [],
      },
      store,
    );

    expect(evidence.terms).toEqual([
      { term: 'FA24', snapshotDigest, detailDigest: null, manifestDigest },
    ]);
  });

  it('bounds concurrent registry object verification', async () => {
    const store = new ConcurrencyTrackingStore();
    const snapshot = encoder.encode('{"frozen":true}\n');
    const manifest = encoder.encode('{"manifest":true}\n');
    const snapshotDigest =
      'ff9f1f7bf5c634879f9ff3c4bd3bf42d40973c7846eb8734d5ae6ad47c744497';
    const manifestDigest =
      'b52ab259c8b9dab5683cbd68defa991ac03d5e92851ab811f23129fe4833d2b9';
    const terms = Array.from({ length: 8 }, (_value, index) => `T${index}`);

    for (const term of terms) {
      store.objects.set(
        `published-snapshots/${term}/${snapshotDigest}.json`,
        snapshot,
      );
      store.objects.set(
        `published-manifests/${term}/${manifestDigest}.json`,
        manifest,
      );
    }

    await publishTermArchive(
      {
        registry: {
          last_update: '2026-07-12T00:00:00.000Z',
          terms: terms.map((term) => ({
            term,
            label: term,
            date_range: null,
            frozen: true,
            generated_at: '2025-01-01T00:00:00.000Z',
            snapshot_path: `published-snapshots/${term}/${snapshotDigest}.json`,
            detail_path: null,
            manifest_path: `published-manifests/${term}/${manifestDigest}.json`,
          })),
        },
        terms: [],
      },
      store,
      () => {},
    );

    expect(store.maxActiveGets).toBeLessThanOrEqual(4);
  });
});
