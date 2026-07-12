import { describe, expect, it } from 'vitest';

import {
  createUpstashRedisEvalClient,
  type UpstashRedisCommands,
} from './upstashRedis.js';

describe('Upstash Redis REST adapter', () => {
  it('maps the existing limiter eval contract to Upstash keys and args', async () => {
    const calls: unknown[] = [];
    const redis = {
      eval(script, keys, args) {
        calls.push({ script, keys, args });
        return Promise.resolve([1, 0]);
      },
    } as UpstashRedisCommands;
    const client = createUpstashRedisEvalClient(redis);

    await expect(
      client.eval('return ARGV[1]', {
        keys: ['verification:source'],
        arguments: ['5', '900000'],
      }),
    ).resolves.toEqual([1, 0]);
    expect(calls).toEqual([
      {
        script: 'return ARGV[1]',
        keys: ['verification:source'],
        args: ['5', '900000'],
      },
    ]);
  });
});
