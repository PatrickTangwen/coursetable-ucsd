import { describe, expect, it } from 'vitest';

import {
  createUpstashAppSession,
  type UpstashSessionRedis,
} from './upstashSession.js';

class MemoryRedis implements UpstashSessionRedis {
  readonly values = new Map<string, string>();
  readonly writes: { command: 'del' | 'setex'; seconds?: number }[] = [];

  get<T>(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(value ? (JSON.parse(value) as T) : null);
  }

  setex(key: string, seconds: number, value: string) {
    this.writes.push({ command: 'setex', seconds });
    this.values.set(key, value);
    return Promise.resolve('OK');
  }

  del(key: string) {
    this.writes.push({ command: 'del' });
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }
}

describe('Upstash hosted session', () => {
  it('revokes the previous session when verification establishes a new one', async () => {
    const redis = new MemoryRedis();
    const session = createUpstashAppSession(redis, 'session-secret');
    const firstHeaders = new Headers();
    await session.establish(
      new Request('https://staging.sungridplanner.com'),
      { user_id: 1, verified_email: 'first@ucsd.edu' },
      firstHeaders,
    );
    const firstCookie = firstHeaders.get('set-cookie')!.split(';')[0]!;
    const firstRequest = new Request('https://staging.sungridplanner.com', {
      headers: { cookie: firstCookie },
    });
    expect(redis.writes).toEqual([{ command: 'setex', seconds: 2_592_000 }]);
    const writesBeforeRestore = redis.writes.length;
    await expect(session.getUser(firstRequest)).resolves.toEqual({
      user_id: 1,
      verified_email: 'first@ucsd.edu',
    });
    expect(redis.writes).toHaveLength(writesBeforeRestore);

    const secondHeaders = new Headers();
    await session.establish(
      firstRequest,
      { user_id: 2, verified_email: 'second@ucsd.edu' },
      secondHeaders,
    );

    await expect(session.getUser(firstRequest)).resolves.toBeNull();
    const secondCookie = secondHeaders.get('set-cookie')!.split(';')[0]!;
    await expect(
      session.getUser(
        new Request('https://staging.sungridplanner.com', {
          headers: { cookie: secondCookie },
        }),
      ),
    ).resolves.toEqual({
      user_id: 2,
      verified_email: 'second@ucsd.edu',
    });
  });
});
