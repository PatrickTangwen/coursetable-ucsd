import { describe, expect, it } from 'vitest';

import {
  createRedisVerificationAttemptLimiter,
  createRedisVerificationRequestLimiter,
} from './verificationRequest.limiter.js';

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

    await expect(limiter.admitSource('203.0.113.4')).resolves.toEqual({
      allowed: true,
    });
    await expect(limiter.consumeSend()).resolves.toEqual({ allowed: true });
    expect(JSON.stringify(calls)).not.toContain('203.0.113.4');
    expect(calls).toEqual([
      {
        keys: [
          expect.stringMatching(/^verification-request:source:[a-f\d]{64}$/u),
        ],
        arguments: ['3', '60000'],
      },
      {
        keys: ['verification-request:global'],
        arguments: ['20', '300000'],
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

    await expect(limiter.admitSource('203.0.113.4')).resolves.toEqual({
      allowed: false,
      retryAfterMs: 42_500,
    });
  });

  it('uses opaque source/email keys and resets only the email budget', async () => {
    const calls: unknown[] = [];
    const limiter = createRedisVerificationAttemptLimiter(
      {
        eval(_script, options) {
          calls.push(options);
          return Promise.resolve(options.arguments.length ? [1, 0] : 1);
        },
      },
      'test-secret',
      {
        sourceLimit: 20,
        sourceWindowMs: 900_000,
        emailLimit: 5,
        emailWindowMs: 900_000,
      },
    );

    await limiter.attempt('203.0.113.4', 'student@ucsd.edu');
    await limiter.resetEmail('student@ucsd.edu');
    expect(JSON.stringify(calls)).not.toMatch(
      /203\.0\.113\.4|student@ucsd\.edu/u,
    );
    expect(calls).toEqual([
      {
        keys: [
          expect.stringMatching(/^verification-attempt:source:[a-f\d]{64}$/u),
          expect.stringMatching(/^verification-attempt:email:[a-f\d]{64}$/u),
        ],
        arguments: ['20', '900000', '5', '900000'],
      },
      {
        keys: [
          expect.stringMatching(/^verification-attempt:email:[a-f\d]{64}$/u),
        ],
        arguments: [],
      },
    ]);
  });
});
