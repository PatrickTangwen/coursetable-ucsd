import http from 'node:http';

import express from 'express';
import { describe, expect, it } from 'vitest';

import { createPublicGraphqlProxy } from './publicGraphqlProxy.js';

async function listen(server: http.Server) {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Test server has no TCP address');
  return `http://127.0.0.1:${address.port}`;
}

describe('public GraphQL proxy', () => {
  it('sanitizes browser headers and rejects mutations before forwarding', async () => {
    let upstreamHeaders: http.IncomingHttpHeaders | undefined = undefined;
    const upstream = http.createServer((req, res) => {
      upstreamHeaders = req.headers;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: { courses: [] } }));
    });
    const upstreamUrl = await listen(upstream);
    const app = express();
    app.use('/ferry', ...createPublicGraphqlProxy(upstreamUrl));
    const gateway = http.createServer(app);
    const gatewayUrl = await listen(gateway);

    try {
      const read = await fetch(`${gatewayUrl}/ferry/v1/graphql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hasura-role': 'admin',
          'x-hasura-admin-secret': 'browser-controlled-secret',
        },
        body: JSON.stringify({
          query:
            'query { courses(where: {termCode: {_eq: "S326"}}, limit: 1) { courseId } }',
        }),
      });
      expect(read.ok).toBe(true);
      expect(upstreamHeaders?.['x-hasura-role']).toBe('anonymous');
      expect(upstreamHeaders?.['x-hasura-admin-secret']).toBeUndefined();

      upstreamHeaders = undefined;
      const mutation = await fetch(`${gatewayUrl}/ferry/v1/graphql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hasura-role': 'admin',
        },
        body: JSON.stringify({
          query: 'mutation { delete_courses(where: {}) { affected_rows } }',
        }),
      });
      expect(mutation.status).toBe(400);
      expect(upstreamHeaders).toBeUndefined();
    } finally {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          gateway.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
        new Promise<void>((resolve, reject) => {
          upstream.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
      ]);
    }
  });
});
