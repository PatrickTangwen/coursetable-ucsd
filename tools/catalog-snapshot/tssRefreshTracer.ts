import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  runTssPublishedSnapshotPipeline,
  type TssPublishedSnapshotPipelineOptions,
} from './tssPublishedSnapshotPipeline';
import {
  publishAcceptedCatalog,
  type CatalogPublicationStore,
} from '../../worker/src/catalogPublication.js';

type LocalObject = {
  body: Uint8Array;
  cacheControl: string;
  contentType: string;
  etag: string | null;
  lastModified: Date;
};

type LocalAsset = {
  body: ReadableStream<Uint8Array>;
  cacheControl?: string;
  contentLength: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
};

class LocalCatalogStore implements CatalogPublicationStore {
  readonly objects = new Map<string, LocalObject>();
  readonly writeOrder: string[] = [];

  putObject(
    key: string,
    body: Uint8Array,
    options: {
      contentType: string;
      cacheControl: string;
      customMetadata: { [key: string]: string };
    },
  ) {
    const nextBody = Uint8Array.from(body);
    const current = this.objects.get(key);
    if (current && !equalBytes(current.body, nextBody))
      throw new Error(`Immutable local Catalog object changed: ${key}`);
    this.objects.set(key, {
      body: nextBody,
      cacheControl: options.cacheControl,
      contentType: options.contentType,
      etag: options.customMetadata.sha256
        ? `"${options.customMetadata.sha256}"`
        : null,
      lastModified: new Date(),
    });
    this.writeOrder.push(key);
    return Promise.resolve();
  }

  openMetadata() {
    return Promise.resolve(this.openObject('metadata.json'));
  }

  openSnapshot(term: string) {
    const metadata = this.objects.get('metadata.json');
    if (!metadata) return Promise.resolve(null);
    const registry = JSON.parse(new TextDecoder().decode(metadata.body)) as {
      terms?: { term?: unknown; snapshot_path?: unknown }[];
    };
    const entry = registry.terms?.find((candidate) => candidate.term === term);
    const key = entry?.snapshot_path;
    if (typeof key !== 'string') return Promise.resolve(null);
    return Promise.resolve(this.openObject(key));
  }

  private openObject(key: string): LocalAsset | null {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(Uint8Array.from(object.body));
          controller.close();
        },
      }),
      cacheControl: object.cacheControl,
      contentLength: object.body.byteLength,
      contentType: object.contentType,
      etag: object.etag ?? undefined,
      lastModified: object.lastModified,
    };
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function acceptedArtifact(body: Uint8Array) {
  return {
    body,
    size: body.byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}

async function requiredJsonResponse(response: Response | null, label: string) {
  if (!response || response.status !== 200)
    throw new Error(`${label} did not return 200`);
  return { status: response.status, body: (await response.json()) as unknown };
}

/**
 * Runs the credential-free refresh seam used before any attended or hosted
 * action: sanitized source -> Snapshot/Manifest -> immutable local publication
 * -> the production Catalog API response boundary.
 */
export async function runTssRefreshTracer(
  options: TssPublishedSnapshotPipelineOptions,
) {
  const { createPublishedSnapshotResponse } =
    await import('../../api/src/catalog/publishedSnapshot.response.js');
  const pipeline = await runTssPublishedSnapshotPipeline(options);
  if (!pipeline.metadataPath)
    throw new Error('TSS refresh tracer requires Catalog metadata');

  const [snapshotBody, manifestBody, registry] = await Promise.all([
    readFile(pipeline.snapshotPath),
    readFile(pipeline.manifestPath),
    readFile(pipeline.metadataPath),
  ]);
  const snapshot = acceptedArtifact(snapshotBody);
  const manifest = acceptedArtifact(manifestBody);
  const store = new LocalCatalogStore();
  const publication = await publishAcceptedCatalog(
    {
      accepted: true,
      term: pipeline.snapshot.active_planning_term,
      snapshot,
      manifest,
      registry,
    },
    store,
  );
  const term = pipeline.snapshot.active_planning_term;
  const [metadataResponse, snapshotResponse] = await Promise.all([
    createPublishedSnapshotResponse(
      'GET',
      '/api/catalog/metadata',
      new Headers(),
      store,
    ),
    createPublishedSnapshotResponse(
      'GET',
      `/api/catalog/public/${term}`,
      new Headers(),
      store,
    ),
  ]);

  return {
    ...pipeline,
    publication: { ...publication, writeOrder: store.writeOrder },
    api: {
      metadata: await requiredJsonResponse(
        metadataResponse,
        'Catalog metadata',
      ),
      snapshot: await requiredJsonResponse(
        snapshotResponse,
        'Catalog Snapshot',
      ),
    },
  };
}
