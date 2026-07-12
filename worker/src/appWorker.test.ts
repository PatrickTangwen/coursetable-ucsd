import { describe, expect, it } from 'vitest';

import { handleAppWorkerRequest, type AppWorkerEnv } from './appWorker.js';

function incompleteEnvironment() {
  return {
    ASSETS: {
      fetch: () => Promise.resolve(new Response('SunGrid')),
    },
    CATALOG_BUCKET: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
    },
  } as unknown as AppWorkerEnv;
}

const context = {
  waitUntil() {},
} as unknown as ExecutionContext;

describe('hosted App Worker composition', () => {
  it('fails auth closed when hosted bindings are absent', async () => {
    const response = await handleAppWorkerRequest(
      new Request('https://staging.sungridplanner.com/api/auth/current-user'),
      incompleteEnvironment(),
      context,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: 'AUTH_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable.',
    });
  });

  it('keeps static assets available when account bindings are absent', async () => {
    const response = await handleAppWorkerRequest(
      new Request('https://staging.sungridplanner.com/'),
      incompleteEnvironment(),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SunGrid');
  });
});
