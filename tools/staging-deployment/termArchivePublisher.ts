import { digest } from './stagingContract.js';
import type { TermArchiveRegistry } from './termArchive.js';

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
  registry: TermArchiveRegistry;
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

  const evidenceTerms = await Promise.all(
    archive.registry.terms.map(async (entry) => {
      const snapshotDigest = digestFromPath(entry.snapshot_path);
      const manifestDigest = digestFromPath(entry.manifest_path);
      await verifyExisting(
        store,
        'Published Snapshot',
        entry.snapshot_path,
        snapshotDigest,
      );
      await verifyExisting(
        store,
        'Import Manifest',
        entry.manifest_path,
        manifestDigest,
      );
      return { term: entry.term, snapshotDigest, manifestDigest };
    }),
  );

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
    terms: evidenceTerms,
  };
}

async function verifyExisting(
  store: TermArchiveStore,
  label: string,
  key: string,
  expectedDigest: string,
) {
  const remote = await store.get(key);
  if (!remote || digest(remote) !== expectedDigest)
    throw new Error(`${label} durable digest mismatch`);
}

function digestFromPath(value: string) {
  const filename = value.split('/').at(-1);
  const result = filename?.replace(/\.json$/u, '');
  if (!result || !/^[a-f\d]{64}$/u.test(result))
    throw new Error('Term Archive object path has no digest');
  return result;
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
