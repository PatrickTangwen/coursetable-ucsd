import type {
  PublishedSnapshotAsset,
  PublishedSnapshotStore,
} from './publishedSnapshot.store.js';

const snapshotPathPattern = /^\/api\/catalog\/public\/(?<term>[\w-]+)$/u;

export async function createPublishedSnapshotResponse(
  method: string,
  pathname: string,
  requestHeaders: Headers,
  store: PublishedSnapshotStore,
): Promise<Response | null> {
  if (method !== 'GET' && method !== 'HEAD') return null;

  const asset = await resolveAsset(pathname, store);
  if (!asset) return null;
  const headers = assetHeaders(asset);
  if (isNotModified(requestHeaders, asset))
    return new Response(null, { status: 304, headers });
  return new Response(method === 'HEAD' ? null : asset.body, { headers });
}

async function resolveAsset(pathname: string, store: PublishedSnapshotStore) {
  if (pathname === '/api/catalog/metadata') return await store.openMetadata();
  const match = snapshotPathPattern.exec(pathname);
  const term = match?.groups?.term;
  return term ? await store.openSnapshot(term) : null;
}

function assetHeaders(asset: PublishedSnapshotAsset) {
  const headers = new Headers({
    'cache-control': asset.cacheControl ?? 'public, max-age=3600',
    'content-length': String(asset.contentLength),
    'content-type': asset.contentType ?? 'application/json; charset=utf-8',
  });
  if (asset.etag) headers.set('etag', asset.etag);
  if (asset.lastModified)
    headers.set('last-modified', asset.lastModified.toUTCString());
  return headers;
}

function isNotModified(headers: Headers, asset: PublishedSnapshotAsset) {
  const ifNoneMatch = headers.get('if-none-match');
  if (
    asset.etag &&
    ifNoneMatch
      ?.split(',')
      .map((value) => value.trim())
      .some((value) => value === '*' || value === asset.etag)
  )
    return true;

  const ifModifiedSince = headers.get('if-modified-since');
  if (!asset.lastModified || !ifModifiedSince) return false;
  const modifiedSince = Date.parse(ifModifiedSince);
  return (
    Number.isFinite(modifiedSince) &&
    Math.trunc(asset.lastModified.getTime() / 1000) <=
      Math.trunc(modifiedSince / 1000)
  );
}
