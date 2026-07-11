import { describe, expect, it } from 'vitest';

import { createRedisVerificationRequestLimiter } from './verificationRequest.limiter.js';

describe('verification request limiter', () => {
  it('uses opaque source keys and forwards configurable source/global policy', async () => {
    const calls: unknown[] = [];
    const limiter = createRedisVerificationRequestLimiter(
      {
        eval(_script, options) {
          calls.push(options);
          return Promise.resolve([1, 0]);
        },
      },
      'test-secret',
      {
        sourceLimit: 3,
        sourceWindowMs: 60_000,
        globalLimit: 20,
        globalWindowMs: 300_000,
      },
    );

    await expect(limiter.attempt('203.0.113.4')).resolves.toEqual({
      allowed: true,
    });
    expect(JSON.stringify(calls)).not.toContain('203.0.113.4');
    expect(calls).toEqual([
      {
        keys: [
          expect.stringMatching(/^verification-request:source:[a-f\d]{64}$/u),
          'verification-request:global',
        ],
        arguments: ['3', '60000', '20', '300000'],
      },
    ]);
  });

  it('returns the shared-window retry duration when a budget is exhausted', async () => {
    const limiter = createRedisVerificationRequestLimiter(
      { eval: () => Promise.resolve([0, 42_500]) },
      'test-secret',
      {
        sourceLimit: 3,
        sourceWindowMs: 60_000,
        globalLimit: 20,
        globalWindowMs: 300_000,
      },
    );

    await expect(limiter.attempt('203.0.113.4')).resolves.toEqual({
      allowed: false,
      retryAfterMs: 42_500,
    });
  });
});
