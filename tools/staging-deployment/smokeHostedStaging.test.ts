import { describe, expect, it } from 'vitest';

import { runHostedStagingSmoke } from './smokeHostedStaging.js';

describe('hosted staging smoke', () => {
  it('repeats public and unauthenticated seams without creating an identity', async () => {
    const requests: { method: string; pathname: string }[] = [];
    const fetcher = (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      requests.push({ method: request.method, pathname });
      if (pathname === '/api/catalog/metadata') {
        return Promise.resolve(
          Response.json({ terms: [{ term: 'SP26' }] }, { status: 200 }),
        );
      }
      if (pathname === '/api/catalog/public/SP26')
        return Promise.resolve(Response.json({ courses: [] }, { status: 200 }));
      if (pathname === '/')
        return Promise.resolve(new Response('<html></html>', { status: 200 }));
      if (pathname === '/api/auth/current-user') {
        return Promise.resolve(
          Response.json({ authenticated: false }, { status: 200 }),
        );
      }
      if (pathname === '/api/auth/logout')
        return Promise.resolve(Response.json({ ok: true }, { status: 200 }));
      if (pathname === '/api/auth/ucsd/request-verification') {
        return Promise.resolve(
          Response.json({ error: 'INVALID_EMAIL' }, { status: 400 }),
        );
      }
      return Promise.resolve(
        Response.json({ error: 'USER_NOT_FOUND' }, { status: 401 }),
      );
    };

    const evidence = await runHostedStagingSmoke(
      'https://staging.sungridplanner.com',
      fetcher,
      3,
    );

    expect(evidence.result).toBe('passed');
    expect(evidence.repeats).toBe(3);
    expect(requests).toContainEqual({
      method: 'POST',
      pathname: '/api/auth/ucsd/request-verification',
    });
    expect(
      requests.filter(({ pathname }) => pathname === '/api/savedSearches'),
    ).toHaveLength(3);
    expect(
      requests.filter(({ pathname }) => pathname === '/api/savedWorksheets'),
    ).toHaveLength(3);
  });
});
