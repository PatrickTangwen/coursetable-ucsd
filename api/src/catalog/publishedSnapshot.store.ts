export interface PublishedSnapshotAsset {
  body: AsyncIterable<Uint8Array>;
  contentLength: number;
  etag?: string;
  lastModified?: Date;
}

export interface PublishedSnapshotStore {
  openMetadata: () => Promise<PublishedSnapshotAsset | null>;
  openSnapshot: (term: string) => Promise<PublishedSnapshotAsset | null>;
}
