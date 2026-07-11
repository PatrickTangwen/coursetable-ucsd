import express from 'express';

export const staticJSON = (path: string) =>
  express.static(path, {
    cacheControl: true,
    maxAge: '1h',
    lastModified: true,
    etag: true,
    extensions: ['json'],
  });

export function registerStaticCatalogRoutes(
  app: express.Express,
  staticFileDirectory: string,
) {
  app.use(
    '/api/catalog/public',
    staticJSON(`${staticFileDirectory}/catalogs/public`),
  );
  app.use(
    '/api/catalog/metadata',
    staticJSON(`${staticFileDirectory}/metadata.json`),
  );
}
