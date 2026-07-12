import { createR2PublishedSnapshotStore } from './r2CatalogStore.js';
import { createPublishedSnapshotResponse } from '../../api/src/catalog/publishedSnapshot.response.js';

export interface CatalogWorkerEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  CATALOG_BUCKET: R2Bucket;
}

export async function handleCatalogWorkerRequest(
  request: Request,
  environment: CatalogWorkerEnv,
) {
  const url = new URL(request.url);
  const catalogResponse = await createPublishedSnapshotResponse(
    request.method,
    url.pathname,
    request.headers,
    createR2PublishedSnapshotStore(environment.CATALOG_BUCKET),
  );
  if (catalogResponse) return catalogResponse;

  if (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/ferry' ||
    url.pathname.startsWith('/ferry/')
  ) {
    return Response.json(
      { error: 'NOT_FOUND' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  return environment.ASSETS.fetch(request);
}

export default {
  fetch: handleCatalogWorkerRequest,
} satisfies ExportedHandler<CatalogWorkerEnv>;
