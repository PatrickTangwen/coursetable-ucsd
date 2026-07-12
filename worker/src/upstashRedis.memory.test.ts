import { describe, expect, it } from 'vitest';

import { createMemoryUpstashRedis } from './upstashRedis.memory.js';
import {
  inspectSingleBudgetScript,
  singleBudgetScript,
} from '../../api/src/core/redisBudget.js';

describe('memory Upstash Redis script contract', () => {
  it('distinguishes budget inspection from consumption by registered script', async () => {
    const redis = createMemoryUpstashRedis();
    const key = 'application-safety:verification-send';

    await expect(
      redis.eval(inspectSingleBudgetScript, [key], ['1']),
    ).resolves.toEqual([1, 0, 0]);
    expect(redis.counters.has(key)).toBe(false);

    await expect(
      redis.eval(singleBudgetScript, [key], ['1', '60000']),
    ).resolves.toEqual([1, 0, 1]);
    expect(redis.counters.get(key)).toBe(1);
  });

  it('rejects unregistered Lua instead of guessing behavior from its text', async () => {
    const redis = createMemoryUpstashRedis();

    await expect(
      redis.eval(
        "return redis.call('INCRBY', KEYS[1], ARGV[1])",
        ['usage:workers:2026-07'],
        ['1'],
      ),
    ).rejects.toThrow('Unknown Redis script');
  });
});
