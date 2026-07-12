import { digest } from './stagingContract.js';

type StoreOptions = {
  cacheControl: string;
  contentType: string;
  metadata?: { [key: string]: string };
  storageClass: 'STANDARD';
};

export interface TermArchiveStore {
  get: (key: string) => Promise<Uint8Array | null>;
  put: (key: string, body: Uint8Array, options: StoreOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

type Archive = {
  registry: { last_update: string; terms: unknown[] };
  terms: {
    term: string;
    snapshot: { body: Uint8Array; sha256: string };
    manifest: { body: Uint8Array; sha256: string };
  }[];
};

const encoder = new TextEncoder();

export async function publishTermArchive(
  archive: Archive,
  store: TermArchiveStore,
) {
  const previousMetadata = await store.get('metadata.json');

  for (const { term, snapshot, manifest } of archive.terms) {
    await putAndVerify(
      store,
      'Published Snapshot',
      `published-snapshots/${term}/${snapshot.sha256}.json`,
      snapshot,
      {
        cacheControl: 'public, max-age=3600',
        contentType: 'application/json; charset=utf-8',
        metadata: { sha256: snapshot.sha256, term },
        storageClass: 'STANDARD',
      },
    );
    await putAndVerify(
      store,
      'Import Manifest',
      `published-manifests/${term}/${manifest.sha256}.json`,
      manifest,
      {
        cacheControl: 'private, no-store',
        contentType: 'application/json; charset=utf-8',
        metadata: { sha256: manifest.sha256, term },
        storageClass: 'STANDARD',
      },
    );
  }

  const metadataBody = encoder.encode(`${JSON.stringify(archive.registry)}\n`);
  const metadataDigest = digest(metadataBody);
  try {
    await putAndVerify(
      store,
      'Catalog metadata',
      'metadata.json',
      { body: metadataBody, sha256: metadataDigest },
      {
        cacheControl: 'public, max-age=3600',
        contentType: 'application/json; charset=utf-8',
        metadata: { sha256: metadataDigest },
        storageClass: 'STANDARD',
      },
    );
  } catch (error) {
    if (previousMetadata) {
      await store.put('metadata.json', previousMetadata, {
        cacheControl: 'public, max-age=3600',
        contentType: 'application/json; charset=utf-8',
        storageClass: 'STANDARD',
      });
    } else {
      await store.delete('metadata.json');
    }
    throw error;
  }

  return {
    metadataDigest,
    terms: archive.terms.map(({ term, snapshot, manifest }) => ({
      term,
      snapshotDigest: snapshot.sha256,
      manifestDigest: manifest.sha256,
    })),
  };
}

async function putAndVerify(
  store: TermArchiveStore,
  label: string,
  key: string,
  artifact: { body: Uint8Array; sha256: string },
  options: StoreOptions,
) {
  if (digest(artifact.body) !== artifact.sha256)
    throw new Error(`${label} local digest mismatch`);
  await store.put(key, artifact.body, options);
  const remote = await store.get(key);
  if (!remote || digest(remote) !== artifact.sha256)
    throw new Error(`${label} remote digest mismatch`);
}
