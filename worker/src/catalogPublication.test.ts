import { describe, expect, it } from 'vitest';

import {
  publishAcceptedCatalog,
  type CatalogPublicationStore,
} from './catalogPublication.js';

class MemoryPublicationStore implements CatalogPublicationStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly failKey: string | undefined;

  constructor(failKey?: string) {
    this.failKey = failKey;
  }

  putObject(key: string, body: Uint8Array) {
    if (key === this.failKey) return Promise.reject(new Error('upload failed'));
    this.objects.set(key, body);
    return Promise.resolve();
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256(body: Uint8Array) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(body).buffer,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function acceptedInput() {
  const snapshot = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      generated_at: '2026-07-11T00:00:00.000Z',
      courses: [],
    }),
  );
  const manifest = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      generated_at: '2026-07-11T00:00:00.000Z',
      summary: { ok: 3, empty: 0, failed: 0, partial: 0 },
      cells: [
        { term: 'FA26', source: 'schedule_of_classes', status: 'ok' },
        { term: 'FA26', source: 'general_catalog', status: 'ok' },
        {
          term: 'FA26',
          source: 'instructor_grade_archive',
          status: 'ok',
        },
      ],
    }),
  );
  const registry = encoder.encode(
    JSON.stringify({
      last_update: '2026-07-11T00:00:00.000Z',
      terms: [
        {
          term: 'FA26',
          label: 'Fall 2026',
          date_range: {
            start: '2026-09-24',
            end: '2026-12-12',
          },
          frozen: false,
          generated_at: '2026-07-11T00:00:00.000Z',
          snapshot_path: 'catalogs/public/FA26.json',
          manifest_path: 'catalogs/import-manifests/FA26.json',
        },
      ],
    }),
  );

  return {
    accepted: true as const,
    term: 'FA26',
    snapshot: {
      body: snapshot,
      size: snapshot.byteLength,
      sha256: await sha256(snapshot),
    },
    manifest: {
      body: manifest,
      size: manifest.byteLength,
      sha256: await sha256(manifest),
    },
    registry,
  };
}

describe('private R2 Catalog publication', () => {
  it('writes immutable accepted objects before switching the metadata pointer', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();

    const result = await publishAcceptedCatalog(input, store);

    expect([...store.objects.keys()]).toEqual([
      `published-snapshots/FA26/${input.snapshot.sha256}.json`,
      `published-manifests/FA26/${input.manifest.sha256}.json`,
      'metadata.json',
    ]);
    expect(result.snapshotKey).toBe(
      `published-snapshots/FA26/${input.snapshot.sha256}.json`,
    );
    expect(result.manifestKey).toBe(
      `published-manifests/FA26/${input.manifest.sha256}.json`,
    );
    const publishedRegistry = JSON.parse(
      decoder.decode(store.objects.get('metadata.json')),
    ) as {
      terms: { snapshot_path: string; manifest_path: string }[];
    };
    expect(publishedRegistry.terms[0]).toMatchObject({
      snapshot_path: result.snapshotKey,
      manifest_path: result.manifestKey,
    });
  });

  it('publishes only the strict public registry shape', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    const registry = JSON.parse(decoder.decode(input.registry)) as {
      terms: { r2_credential?: string }[];
      r2_credential?: string;
    };
    registry.r2_credential = 'secret';
    registry.terms[0]!.r2_credential = 'secret';
    input.registry = encoder.encode(JSON.stringify(registry));

    await publishAcceptedCatalog(input, store);

    const metadata = decoder.decode(store.objects.get('metadata.json'));
    expect(metadata).not.toContain('secret');
    expect(metadata).not.toContain('r2_credential');
  });

  it('rejects provider URLs anywhere in term object paths', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    const registry = JSON.parse(decoder.decode(input.registry)) as {
      terms: unknown[];
    };
    registry.terms.push({
      term: 'WI27',
      label: 'Winter 2027',
      date_range: null,
      frozen: false,
      generated_at: '2026-07-11T00:00:00.000Z',
      snapshot_path: 'https://public.r2.dev/WI27.json',
      manifest_path: null,
    });
    input.registry = encoder.encode(JSON.stringify(registry));

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'Supported Term entry is invalid',
    );
    expect(store.objects.size).toBe(0);
  });

  it('rejects a digest mismatch before uploading any object', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    input.snapshot.sha256 = '0'.repeat(64);

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'Published Snapshot digest mismatch',
    );
    expect(store.objects.size).toBe(0);
  });

  it('rejects a manifest that has not passed the acceptance gate', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();

    await expect(
      publishAcceptedCatalog({ ...input, accepted: false as never }, store),
    ).rejects.toThrow('Import Manifest is not accepted');
    expect(store.objects.size).toBe(0);
  });

  it('rejects a Snapshot whose term does not match the accepted term', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    input.snapshot.body = encoder.encode(
      JSON.stringify({ active_planning_term: 'SP26', courses: [] }),
    );
    input.snapshot.size = input.snapshot.body.byteLength;
    input.snapshot.sha256 = await sha256(input.snapshot.body);

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'Published Snapshot term mismatch',
    );
    expect(store.objects.size).toBe(0);
  });

  it('does not switch metadata when an immutable object upload is partial', async () => {
    const input = await acceptedInput();
    const manifestKey = `published-manifests/FA26/${input.manifest.sha256}.json`;
    const store = new MemoryPublicationStore(manifestKey);
    const previousMetadata = encoder.encode('{"previous":true}');
    store.objects.set('metadata.json', previousMetadata);

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'upload failed',
    );
    expect(store.objects.get('metadata.json')).toBe(previousMetadata);
  });

  it('rejects an unsupported or unsafe term before upload', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();

    await expect(
      publishAcceptedCatalog({ ...input, term: '../FA26' }, store),
    ).rejects.toThrow('Published Snapshot term is invalid');
    expect(store.objects.size).toBe(0);
  });

  it('rejects a supported-shape term that is absent from metadata', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    input.snapshot.body = encoder.encode(
      JSON.stringify({ active_planning_term: 'WI27', courses: [] }),
    );
    input.snapshot.size = input.snapshot.body.byteLength;
    input.snapshot.sha256 = await sha256(input.snapshot.body);
    input.manifest.body = encoder.encode(
      JSON.stringify({
        active_planning_term: 'WI27',
        summary: { ok: 0, empty: 0, failed: 0, partial: 0 },
        cells: [],
      }),
    );
    input.manifest.size = input.manifest.body.byteLength;
    input.manifest.sha256 = await sha256(input.manifest.body);

    await expect(
      publishAcceptedCatalog({ ...input, term: 'WI27' }, store),
    ).rejects.toThrow('Unsupported Published Snapshot term: WI27');
    expect(store.objects.size).toBe(0);
  });

  it('rejects a declared size mismatch before upload', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    input.manifest.size += 1;

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'Import Manifest size mismatch',
    );
    expect(store.objects.size).toBe(0);
  });

  it('rejects an Import Manifest with an unknown cell status', async () => {
    const store = new MemoryPublicationStore();
    const input = await acceptedInput();
    input.manifest.body = encoder.encode(
      JSON.stringify({
        active_planning_term: 'FA26',
        summary: { ok: 0, empty: 0, failed: 0, partial: 0 },
        cells: [{ term: 'FA26', status: 'invented' }],
      }),
    );
    input.manifest.size = input.manifest.body.byteLength;
    input.manifest.sha256 = await sha256(input.manifest.body);

    await expect(publishAcceptedCatalog(input, store)).rejects.toThrow(
      'Import Manifest cell status is invalid',
    );
    expect(store.objects.size).toBe(0);
  });
});
