import { Redis } from '@upstash/redis/cloudflare';

import type { UpstashSessionRedis } from './upstashSession.js';
import type { RedisEvalClient } from '../../api/src/auth/verificationRequest.limiter.js';

export interface UpstashRedisCommands extends UpstashSessionRedis {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>;
}

export function createUpstashRedisCommands(url: string, token: string) {
  if (!url.trim()) throw new Error('Upstash Redis REST URL is required');
  if (!token.trim()) throw new Error('Upstash Redis REST token is required');
  const redis = new Redis({ url, token });
  return {
    del: (key: string) => redis.del(key),
    get: <T>(key: string) => redis.get<T>(key),
    setex: (key: string, seconds: number, value: string) =>
      redis.setex(key, seconds, value),
    eval: (script: string, keys: string[], args: string[]) =>
      redis.eval(script, keys, args),
  } satisfies UpstashRedisCommands;
}

export function createUpstashRedisEvalClient(
  redis: UpstashRedisCommands,
): RedisEvalClient {
  return {
    eval: (script, { keys, arguments: args }) => redis.eval(script, keys, args),
  };
}
