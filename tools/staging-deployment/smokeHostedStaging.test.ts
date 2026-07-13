import { describe, expect, it } from 'vitest';

import { createProductionContract } from './productionContract.js';
import {
  runHostedDeploymentSmoke,
  runHostedStagingSmoke,
} from './smokeHostedStaging.js';

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

  it('waits through transient edge connection failures before running smoke', async () => {
    const baseFetcher = smokeFetcher({ authenticated: false, user: null });
    const delays: number[] = [];
    let connectionAttempts = 0;
    const fetcher = (input: string | URL | Request, init?: RequestInit) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname === '/api/catalog/metadata' && connectionAttempts++ < 2)
        return Promise.reject(new Error('Unable to connect'));
      return baseFetcher(input, init);
    };

    const evidence = await runHostedStagingSmoke(
      'https://staging.sungridplanner.com',
      fetcher,
      3,
      {
        overallTimeoutMs: 1_000,
        attemptTimeoutMs: 100,
        delayMs: 25,
        sleep(delayMs: number) {
          delays.push(delayMs);
          return Promise.resolve();
        },
      },
    );

    expect(evidence.result).toBe('passed');
    expect(delays).toEqual([25, 25]);
  });

  it('does not retry an HTTP application failure', async () => {
    let attempts = 0;
    const fetcher = () => {
      attempts += 1;
      return Promise.resolve(
        new Response('application failure', { status: 500 }),
      );
    };

    await expect(
      runHostedStagingSmoke('https://staging.sungridplanner.com', fetcher, 3, {
        overallTimeoutMs: 1_000,
        attemptTimeoutMs: 100,
        delayMs: 0,
        sleep: () => Promise.resolve(),
      }),
    ).rejects.toThrow('returned 500; expected 200');
    expect(attempts).toBe(1);
  });

  it('enforces the overall readiness deadline when fetch never settles', async () => {
    const fetcher = (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('request aborted'));
        });
      });
    const startedAt = performance.now();

    await expect(
      runHostedStagingSmoke('https://staging.sungridplanner.com', fetcher, 3, {
        overallTimeoutMs: 40,
        attemptTimeoutMs: 10,
        delayMs: 1,
      }),
    ).rejects.toThrow('readiness timed out');
    expect(performance.now() - startedAt).toBeLessThan(250);
  });
});

describe('hosted Production smoke', () => {
  it('proves the deployed public login boundary remains disabled', async () => {
    const contract = createProductionContract({
      DEPLOYMENT_TARGET: 'production',
      CLOUDFLARE_PRODUCTION_HOSTNAME: 'sungridplanner.com',
      CLOUDFLARE_WORKER_NAME: 'sungrid-production',
      R2_CATALOG_BUCKET: 'sungrid-production-catalog',
      VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
      PRODUCTION_ISOLATION_VERIFIED_AT: '2026-07-13T20:00:00.000Z',
    });
    const fetcher = smokeFetcher(
      { authenticated: false, user: null },
      false,
      404,
    );

    const evidence = await runHostedDeploymentSmoke(
      'https://sungridplanner.com',
      contract,
      fetcher,
      3,
    );

    expect(evidence).toMatchObject({
      result: 'passed',
      origin: 'https://sungridplanner.com',
      publicLoginEnabled: false,
      authenticatedIdentityCreated: false,
    });
    expect(evidence.paths).not.toContainEqual(
      expect.objectContaining({ pathname: '/api/savedSearches' }),
    );
  });
});

function smokeFetcher(
  currentUser: unknown,
  cpuFailure = false,
  loginStatus = 400,
) {
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
        Response.json(
          { error: loginStatus === 404 ? 'NOT_FOUND' : 'INVALID_EMAIL' },
          { status: loginStatus },
        ),
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
