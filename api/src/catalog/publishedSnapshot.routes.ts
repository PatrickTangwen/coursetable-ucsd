import type express from 'express';
import asyncHandler from 'express-async-handler';

import type {
  PublishedSnapshotAsset,
  PublishedSnapshotStore,
} from './publishedSnapshot.store.js';

const publishedTermPattern = /^[\w-]+$/u;

async function sendAsset(
  req: express.Request,
  res: express.Response,
  asset: PublishedSnapshotAsset | null,
  next: express.NextFunction,
) {
  if (!asset) {
    next();
    return;
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.type('json');
  res.set('Content-Length', String(asset.contentLength));
  if (asset.etag) res.set('ETag', asset.etag);
  if (asset.lastModified)
    res.set('Last-Modified', asset.lastModified.toUTCString());

  if (req.fresh) {
    res.status(304).end();
    return;
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  for await (const chunk of asset.body) {
    if (!res.write(chunk)) {
      await new Promise<void>((resolve) => {
        res.once('drain', resolve);
      });
    }
  }
  res.end();
}

export function registerPublishedSnapshotRoutes(
  app: express.IRouter,
  store: PublishedSnapshotStore,
) {
  app.get(
    '/api/catalog/metadata',
    asyncHandler(async (req, res, next) => {
      await sendAsset(req, res, await store.openMetadata(), next);
    }),
  );
  app.get(
    '/api/catalog/public/:term',
    asyncHandler(async (req, res, next) => {
      const { term } = req.params;
      if (!term || !publishedTermPattern.test(term)) {
        next();
        return;
      }
      await sendAsset(req, res, await store.openSnapshot(term), next);
    }),
  );
}
