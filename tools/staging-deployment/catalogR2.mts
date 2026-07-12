import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalogArchive } from './catalogArchive.js';
import { publishCatalogArchive } from './catalogPublisher.js';
import { createR2CatalogStore } from './r2CatalogStore.js';

const [, , command] = process.argv;
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
const publicationPath = path.join(
  artifactDirectory,
  'catalog-publication.json',
);
const backupPath = path.join(artifactDirectory, 'catalog-metadata-before.json');
const backupMarkerPath = path.join(
  artifactDirectory,
  'catalog-metadata-before.exists',
);
const store = createR2CatalogStore();
await mkdir(artifactDirectory, { recursive: true });

if (command === 'publish') {
  const previous = await store.get('metadata.json');
  if (previous) {
    await writeFile(backupPath, previous, { mode: 0o600 });
    await writeFile(backupMarkerPath, 'present\n');
  } else {
    await rm(backupPath, { force: true });
    await rm(backupMarkerPath, { force: true });
  }
  const archive = await buildCatalogArchive(root);
  const evidence = await publishCatalogArchive(archive, store);
  const result = {
    result: 'published-and-verified',
    storageClass: 'STANDARD',
    metadataDigest: evidence.metadataDigest,
    terms: evidence.terms,
  };
  await writeFile(publicationPath, `${JSON.stringify(result)}\n`);
  console.log(JSON.stringify(result));
} else if (command === 'restore') {
  const publicationExists = await exists(publicationPath);
  if (!publicationExists) {
    console.log(JSON.stringify({ result: 'not-required' }));
    process.exit(0);
  }
  if (await exists(backupMarkerPath)) {
    const body = await readFile(backupPath);
    await store.put('metadata.json', body, {
      cacheControl: 'public, max-age=3600',
      contentType: 'application/json; charset=utf-8',
      metadata: { sha256: digest(body) },
      storageClass: 'STANDARD',
    });
    const restored = await store.get('metadata.json');
    if (!restored || digest(restored) !== digest(body))
      throw new Error('Catalog metadata restoration verification failed');
  } else {
    await store.delete('metadata.json');
    if (await store.get('metadata.json'))
      throw new Error('Catalog metadata removal verification failed');
  }
  console.log(JSON.stringify({ result: 'restored-last-accepted-metadata' }));
} else {
  throw new Error('Usage: catalogR2.mts publish|restore');
}

function digest(body: Uint8Array) {
  return createHash('sha256').update(body).digest('hex');
}

async function exists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}
