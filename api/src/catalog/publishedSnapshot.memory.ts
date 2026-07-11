import type {
  PublishedSnapshotAsset,
  PublishedSnapshotStore,
} from './publishedSnapshot.store.js';

interface MemoryPublishedSnapshotInput {
  metadata: string;
  snapshots: { [key: string]: string };
}

function createAsset(content: string): PublishedSnapshotAsset {
  const bytes = new TextEncoder().encode(content);
  return {
    contentLength: bytes.byteLength,
    body: (async function* memoryBody() {
      yield bytes;
    })(),
  };
}

export function createMemoryPublishedSnapshotStore({
  metadata,
  snapshots,
}: MemoryPublishedSnapshotInput): PublishedSnapshotStore {
  return {
    openMetadata: () => Promise.resolve(createAsset(metadata)),
    openSnapshot: (term) =>
      Promise.resolve(
        Object.hasOwn(snapshots, term) ? createAsset(snapshots[term]!) : null,
      ),
  };
}
