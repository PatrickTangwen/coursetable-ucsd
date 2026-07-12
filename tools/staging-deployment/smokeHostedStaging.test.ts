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

  it('rejects a current-user response that claims an authenticated identity', async () => {
    const fetcher = smokeFetcher({ authenticated: true, user: { id: '1' } });

    await expect(
      runHostedStagingSmoke('https://staging.sungridplanner.com', fetcher, 3),
    ).rejects.toThrow('unexpected authenticated Session');
  });

  it('classifies a Cloudflare CPU-limit response before generic status failure', async () => {
    const fetcher = smokeFetcher({ authenticated: false, user: null }, true);

    await expect(
      runHostedStagingSmoke('https://staging.sungridplanner.com', fetcher, 3),
    ).rejects.toThrow('Workers Free CPU-limit incompatibility');
  });
});

function smokeFetcher(currentUser: unknown, cpuFailure = false) {
  return (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);
    if (cpuFailure && pathname === '/') {
      return Promise.resolve(
        new Response('Error code 1102: Worker exceeded CPU time limit', {
          status: 500,
        }),
      );
    }
    if (pathname === '/api/catalog/metadata')
      return Promise.resolve(Response.json({ terms: [{ term: 'SP26' }] }));
    if (pathname === '/api/auth/current-user')
      return Promise.resolve(Response.json(currentUser));
    if (pathname === '/api/auth/ucsd/request-verification') {
      return Promise.resolve(
        Response.json({ error: 'INVALID_EMAIL' }, { status: 400 }),
      );
    }
    if (
      pathname === '/api/savedSearches' ||
      pathname === '/api/savedWorksheets'
    ) {
      return Promise.resolve(
        Response.json({ error: 'USER_NOT_FOUND' }, { status: 401 }),
      );
    }
    return Promise.resolve(Response.json({ ok: true }));
  };
}
