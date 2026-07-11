import http from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTrustedProxyPolicy,
  parseTrustedProxyCidrs,
} from './trustedProxy.js';

describe('trusted proxy policy', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  async function reportedIp(cidrs: readonly string[], forwardedFor: string) {
    const app = express();
    app.set('trust proxy', createTrustedProxyPolicy(cidrs));
    app.get('/', (req, res) => res.json({ ip: req.ip }));
    const server = http.createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address');
    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      headers: { 'x-forwarded-for': forwardedFor },
    });
    return (await response.json()) as { ip: string };
  }

  it('trusts no proxy by default, so direct clients cannot spoof XFF', async () => {
    await expect(reportedIp([], '198.51.100.8')).resolves.toEqual({
      ip: '127.0.0.1',
    });
  });

  it('stops at the first untrusted hop in a proxy chain', async () => {
    await expect(
      reportedIp(['127.0.0.0/8'], '198.51.100.8, 10.0.0.7'),
    ).resolves.toEqual({ ip: '10.0.0.7' });
  });

  it('uses the client supplied by an explicitly trusted proxy chain', async () => {
    await expect(
      reportedIp(['127.0.0.0/8', '10.0.0.0/8'], '198.51.100.8, 10.0.0.7'),
    ).resolves.toEqual({ ip: '198.51.100.8' });
    expect(parseTrustedProxyCidrs(' 127.0.0.0/8, 10.0.0.0/8 ')).toEqual([
      '127.0.0.0/8',
      '10.0.0.0/8',
    ]);
  });
});
