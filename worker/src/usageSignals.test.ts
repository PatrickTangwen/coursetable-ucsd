import { describe, expect, it } from 'vitest';

import {
  classifyUsageLevel,
  createRedisUsageSignals,
  type UsageSignal,
} from './usageSignals.js';

const allowances = {
  workers: 10_000_000,
  r2: 10_000_000,
  neon: 200_000,
  upstash: 80_000,
  resend: 3_000,
};

function createRedis(counters = new Map<string, number>()) {
  const evalCalls: { keys: string[]; args: string[] }[] = [];
  return {
    counters,
    evalCalls,
    del: () => Promise.resolve(1),
    setex: () => Promise.resolve('OK' as const),
    get: <T>(key: string) =>
      Promise.resolve((counters.get(key) ?? null) as T | null),
    eval(_script: string, keys: string[], args: string[]) {
      evalCalls.push({ keys, args });
      const next = (counters.get(keys[0]!) ?? 0) + Number(args[0]);
      counters.set(keys[0]!, next);
      return Promise.resolve(next);
    },
  };
}

describe('usage signal levels', () => {
  it.each([
    [699, 1000, 'ok'],
    [700, 1000, 'attention'],
    [899, 1000, 'attention'],
    [900, 1000, 'urgent'],
    [1000, 1000, 'urgent'],
    [0, 1000, 'ok'],
  ] as const)('classifies %d of %d as %s', (used, allowance, expected) => {
    expect(classifyUsageLevel(used, allowance)).toBe(expected);
  });
});

describe('Redis usage signals', () => {
  it('counts provider usage in a UTC month key with a bounded expiry', async () => {
    const redis = createRedis();
    const signals = createRedisUsageSignals(redis, {
      allowances,
      now: () => Date.parse('2026-07-12T10:00:00.000Z'),
      emit() {},
    });

    await signals.record({ workers: 1, r2: 2 });

    expect(redis.evalCalls).toEqual([
      { keys: ['usage:workers:2026-07'], args: ['1', '3456000000'] },
      { keys: ['usage:r2:2026-07'], args: ['2', '3456000000'] },
    ]);
    expect(redis.counters.get('usage:workers:2026-07')).toBe(1);
    expect(redis.counters.get('usage:r2:2026-07')).toBe(2);
  });

  it('emits a maintainer signal exactly when usage crosses 70 or 90 percent', async () => {
    const emitted: UsageSignal[] = [];
    const redis = createRedis(new Map([['usage:resend:2026-07', 2_098]]));
    const signals = createRedisUsageSignals(redis, {
      allowances,
      now: () => Date.parse('2026-07-12T10:00:00.000Z'),
      emit: (signal) => emitted.push(signal),
    });

    await signals.record({ resend: 1 }); // 2099: ok
    await signals.record({ resend: 1 }); // 2100: crosses 70%
    await signals.record({ resend: 1 }); // 2101: still attention
    await signals.record({ resend: 599 }); // 2700: crosses 90%
    await signals.record({ resend: 1 }); // 2701: still urgent

    expect(emitted).toEqual([
      {
        signal: 'usage-signal',
        provider: 'resend',
        level: 'attention',
        used: 2_100,
        allowance: 3_000,
        month: '2026-07',
      },
      {
        signal: 'usage-signal',
        provider: 'resend',
        level: 'urgent',
        used: 2_700,
        allowance: 3_000,
        month: '2026-07',
      },
    ]);
  });

  it('attaches deployment identity to emitted signals when available', async () => {
    const emitted: UsageSignal[] = [];
    const redis = createRedis(new Map([['usage:upstash:2026-07', 55_999]]));
    const signals = createRedisUsageSignals(redis, {
      allowances,
      now: () => Date.parse('2026-07-12T10:00:00.000Z'),
      emit: (signal) => emitted.push(signal),
      deployment: { versionId: 'v-123', versionTag: 'deploy-tag' },
    });

    await signals.record({ upstash: 1 });

    expect(emitted).toEqual([
      {
        signal: 'usage-signal',
        provider: 'upstash',
        level: 'attention',
        used: 56_000,
        allowance: 80_000,
        month: '2026-07',
        deployment: { versionId: 'v-123', versionTag: 'deploy-tag' },
      },
    ]);
  });

  it('never propagates a usage-store failure to the caller', async () => {
    const signals = createRedisUsageSignals(
      {
        get: () => Promise.reject(new Error('redis down')),
        eval: () => Promise.reject(new Error('redis down')),
      },
      {
        allowances,
        now: () => Date.parse('2026-07-12T10:00:00.000Z'),
        emit() {},
      },
    );

    await expect(signals.record({ workers: 1 })).resolves.toBeUndefined();
  });

  it('evaluates every provider counter for the scheduled maintainer report', async () => {
    const redis = createRedis(
      new Map([
        ['usage:workers:2026-07', 7_000_000],
        ['usage:resend:2026-07', 2_800],
      ]),
    );
    const signals = createRedisUsageSignals(redis, {
      allowances,
      now: () => Date.parse('2026-07-12T10:00:00.000Z'),
      emit() {},
    });

    await expect(signals.evaluate()).resolves.toEqual([
      {
        provider: 'workers',
        level: 'attention',
        used: 7_000_000,
        allowance: 10_000_000,
        month: '2026-07',
      },
      {
        provider: 'r2',
        level: 'ok',
        used: 0,
        allowance: 10_000_000,
        month: '2026-07',
      },
      {
        provider: 'neon',
        level: 'ok',
        used: 0,
        allowance: 200_000,
        month: '2026-07',
      },
      {
        provider: 'upstash',
        level: 'ok',
        used: 0,
        allowance: 80_000,
        month: '2026-07',
      },
      {
        provider: 'resend',
        level: 'urgent',
        used: 2_800,
        allowance: 3_000,
        month: '2026-07',
      },
    ]);
  });
});
