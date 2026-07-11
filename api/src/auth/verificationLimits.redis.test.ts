import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRedisVerificationAttemptLimiter,
  createRedisVerificationRequestLimiter,
} from './verificationRequest.limiter.js';

const redisUrl = process.env.VERIFICATION_LIMIT_REDIS_TEST_URL;

describe.skipIf(!redisUrl)('Redis verification limits', () => {
  const redis = createClient({ url: redisUrl });

  beforeAll(async () => {
    await redis.connect();
    await redis.flushDb();
  });

  afterAll(async () => {
    await redis.flushDb();
    await redis.disconnect();
  });

  it('atomically enforces request source and global budgets', async () => {
    const limiter = createRedisVerificationRequestLimiter(redis, 'secret', {
      sourceLimit: 2,
      sourceWindowMs: 60_000,
      globalLimit: 3,
      globalWindowMs: 60_000,
    });
    await expect(limiter.attempt('source-a')).resolves.toEqual({
      allowed: true,
    });
    await expect(limiter.attempt('source-a')).resolves.toEqual({
      allowed: true,
    });
    await expect(limiter.attempt('source-a')).resolves.toMatchObject({
      allowed: false,
    });
    await expect(limiter.attempt('source-b')).resolves.toEqual({
      allowed: true,
    });
    await expect(limiter.attempt('source-c')).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('enforces guess budgets and resets only the successful email', async () => {
    const limiter = createRedisVerificationAttemptLimiter(redis, 'secret-2', {
      sourceLimit: 10,
      sourceWindowMs: 60_000,
      emailLimit: 2,
      emailWindowMs: 60_000,
    });
    await limiter.attempt('source-a', 'student@ucsd.edu');
    await limiter.attempt('source-b', 'student@ucsd.edu');
    await expect(
      limiter.attempt('source-c', 'student@ucsd.edu'),
    ).resolves.toMatchObject({ allowed: false });
    await limiter.resetEmail('student@ucsd.edu');
    await expect(
      limiter.attempt('source-c', 'student@ucsd.edu'),
    ).resolves.toEqual({ allowed: true });
  });
});
