import { describe, expect, it } from 'vitest';

import {
  handleCatalogWorkerRequest,
  type CatalogWorkerEnv,
} from './catalogWorker.js';
import type { R2CatalogBucket, R2CatalogObject } from './r2CatalogStore.js';

const encoder = new TextEncoder();

function object(body: string, etag: string): R2CatalogObject {
  const bytes = encoder.encode(body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    size: bytes.byteLength,
    httpEtag: `"${etag}"`,
    uploaded: new Date('2026-07-11T00:00:00.000Z'),
    writeHttpMetadata(headers) {
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('cache-control', 'public, max-age=3600');
    },
  };
}

function createEnvironment(): CatalogWorkerEnv {
  const objects = new Map<string, () => R2CatalogObject>([
    [
      'metadata.json',
      () =>
        object(
          JSON.stringify({
            last_update: '2026-07-11T00:00:00.000Z',
            terms: [
              {
                term: 'FA26',
                snapshot_path: 'published-snapshots/FA26/snapshot.json',
                manifest_path: 'published-manifests/FA26/manifest.json',
              },
            ],
          }),
          'metadata-etag',
        ),
    ],
    [
      'published-snapshots/FA26/snapshot.json',
      () => object(JSON.stringify([{ course_id: 'CSE:100' }]), 'snapshot-etag'),
    ],
  ]);
  const bucket: R2CatalogBucket = {
    get: (key) => Promise.resolve(objects.get(key)?.() ?? null),
    put: () => Promise.resolve(),
  };
  return {
    ASSETS: {
      fetch: () =>
        Promise.resolve(
          new Response('<!doctype html><title>SunGrid</title>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        ),
    },
    CATALOG_BUCKET: bucket as unknown as R2Bucket,
  };
}

describe('single-origin Catalog Worker', () => {
  it('serves React assets and private R2 Catalog routes without legacy surfaces', async () => {
    const environment = createEnvironment();

    const root = await handleCatalogWorkerRequest(
      new Request('https://staging.sungridplanner.com/'),
      environment,
    );
    expect(root.status).toBe(200);
    expect(await root.text()).toContain('<title>SunGrid</title>');

    const metadata = await handleCatalogWorkerRequest(
      new Request('https://staging.sungridplanner.com/api/catalog/metadata'),
      environment,
    );
    expect(metadata.status).toBe(200);
    expect(metadata.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    expect(metadata.headers.get('etag')).toBe('"metadata-etag"');

    const snapshot = await handleCatalogWorkerRequest(
      new Request('https://staging.sungridplanner.com/api/catalog/public/FA26'),
      environment,
    );
    expect(snapshot.status).toBe(200);
    expect(snapshot.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(snapshot.headers.get('etag')).toBe('"snapshot-etag"');
    expect(await snapshot.json()).toEqual([{ course_id: 'CSE:100' }]);
    const notModified = await handleCatalogWorkerRequest(
      new Request(
        'https://staging.sungridplanner.com/api/catalog/public/FA26',
        { headers: { 'if-none-match': '"snapshot-etag"' } },
      ),
      environment,
    );
    expect(notModified.status).toBe(304);
    const head = await handleCatalogWorkerRequest(
      new Request(
        'https://staging.sungridplanner.com/api/catalog/public/FA26',
        { method: 'HEAD' },
      ),
      environment,
    );
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).not.toBeNull();
    expect(await head.text()).toBe('');

    for (const pathname of [
      '/api/catalog/public/NOPE',
      '/api/catalog/refresh',
      '/api/sitemaps/index.xml',
      '/ferry/v1/graphql',
    ]) {
      const response = await handleCatalogWorkerRequest(
        new Request(`https://staging.sungridplanner.com${pathname}`),
        environment,
      );
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('r2.dev');
    }
  });

  it('bounds an R2 read failure without leaking provider detail', async () => {
    const environment = createEnvironment();
    environment.CATALOG_BUCKET = {
      get: () =>
        Promise.reject(new Error('r2 outage at sungrid.r2.dev secret')),
      put: () => Promise.resolve(),
    } as unknown as R2Bucket;

    for (const pathname of [
      '/api/catalog/metadata',
      '/api/catalog/public/FA26',
    ]) {
      const response = await handleCatalogWorkerRequest(
        new Request(`https://staging.sungridplanner.com${pathname}`),
        environment,
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.text();
      expect(JSON.parse(body)).toEqual({
        error: 'CATALOG_UNAVAILABLE',
        message: 'Catalog data is temporarily unavailable.',
      });
      expect(body).not.toContain('r2.dev');
    }

    const assets = await handleCatalogWorkerRequest(
      new Request('https://staging.sungridplanner.com/worksheet'),
      environment,
    );
    expect(assets.status).toBe(200);

    const legacy = await handleCatalogWorkerRequest(
      new Request('https://staging.sungridplanner.com/ferry/v1/graphql'),
      environment,
    );
    expect(legacy.status).toBe(404);
  });
});
