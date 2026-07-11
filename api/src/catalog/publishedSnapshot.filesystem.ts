import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  PublishedSnapshotAsset,
  PublishedSnapshotStore,
} from './publishedSnapshot.store.js';

async function openFile(
  filename: string,
): Promise<PublishedSnapshotAsset | null> {
  const file = await getFileStat(filename);
  if (!file || !file.isFile()) return null;

  return {
    body: createReadStream(filename),
    contentLength: file.size,
    etag: `W/"${file.size.toString(16)}-${Math.trunc(file.mtimeMs).toString(16)}"`,
    lastModified: file.mtime,
  };
}

async function getFileStat(filename: string) {
  try {
    return await stat(filename);
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}

export function createFilesystemPublishedSnapshotStore(
  staticDirectory: string,
): PublishedSnapshotStore {
  return {
    openMetadata: () => openFile(path.join(staticDirectory, 'metadata.json')),
    openSnapshot: (term) =>
      openFile(
        path.join(staticDirectory, 'catalogs', 'public', `${term}.json`),
      ),
  };
}
