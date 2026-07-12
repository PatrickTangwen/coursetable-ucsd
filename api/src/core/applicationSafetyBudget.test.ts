import { describe, expect, it } from 'vitest';

import {
  createRedisApplicationSafetyBudget,
  createUnlimitedApplicationSafetyBudget,
  type SafetyBudgetSignal,
} from './applicationSafetyBudget.js';

const policy = {
  sendLimit: 1000,
  sendWindowMs: 2_592_000_000,
  accountWriteLimit: 50_000,
  accountWriteWindowMs: 2_592_000_000,
};

function countingRedis(counters = new Map<string, number>()) {
  return {
    counters,
    eval(_script: string, options: { keys: string[]; arguments: string[] }) {
      const key = options.keys[0]!;
      const limit = Number(options.arguments[0]);
      const count = counters.get(key) ?? 0;
      if (count >= limit) return Promise.resolve([0, 86_400_000, count]);
      counters.set(key, count + 1);
      return Promise.resolve([1, 0, count + 1]);
    },
  };
}

describe('application safety budget', () => {
  it('consumes dedicated send and account-write budgets with configured policy', async () => {
    const calls: unknown[] = [];
    const budget = createRedisApplicationSafetyBudget(
      {
        eval(_script, options) {
          calls.push(options);
          return Promise.resolve([1, 0, 1]);
        },
      },
      policy,
    );

    await expect(budget.consumeVerificationSend()).resolves.toEqual({
      allowed: true,
    });
    await expect(budget.consumeAccountWrite()).resolves.toEqual({
      allowed: true,
    });
    expect(calls).toEqual([
      {
        keys: ['application-safety:verification-send'],
        arguments: ['1000', '2592000000'],
      },
      {
        keys: ['application-safety:account-write'],
        arguments: ['50000', '2592000000'],
      },
    ]);
  });

  it('fails closed with the remaining window when the budget is exhausted', async () => {
    const budget = createRedisApplicationSafetyBudget(
      { eval: () => Promise.resolve([0, 86_400_000, 1_000]) },
      policy,
    );

    await expect(budget.consumeVerificationSend()).resolves.toEqual({
      allowed: false,
      retryAfterMs: 86_400_000,
    });
    await expect(budget.consumeAccountWrite()).resolves.toEqual({
      allowed: false,
      retryAfterMs: 86_400_000,
    });
  });

  it('emits maintainer signals exactly when a budget crosses 70 or 90 percent', async () => {
    const emitted: SafetyBudgetSignal[] = [];
    const redis = countingRedis(
      new Map([['application-safety:verification-send', 5]]),
    );
    const budget = createRedisApplicationSafetyBudget(
      redis,
      { ...policy, sendLimit: 10 },
      { emit: (signal) => emitted.push(signal) },
    );

    for (let index = 0; index < 5; index += 1) {
      await expect(budget.consumeVerificationSend()).resolves.toEqual({
        allowed: true,
      });
    }

    expect(emitted).toEqual([
      {
        signal: 'safety-budget-signal',
        budget: 'verification-send',
        level: 'attention',
        used: 7,
        limit: 10,
      },
      {
        signal: 'safety-budget-signal',
        budget: 'verification-send',
        level: 'urgent',
        used: 9,
        limit: 10,
      },
    ]);
  });

  it('attaches deployment identity to safety budget signals when available', async () => {
    const emitted: SafetyBudgetSignal[] = [];
    const redis = countingRedis(
      new Map([['application-safety:account-write', 34_999]]),
    );
    const budget = createRedisApplicationSafetyBudget(redis, policy, {
      emit: (signal) => emitted.push(signal),
      deployment: { versionId: 'v-123', versionTag: 'deploy-tag' },
    });

    await budget.consumeAccountWrite();

    expect(emitted).toEqual([
      {
        signal: 'safety-budget-signal',
        budget: 'account-write',
        level: 'attention',
        used: 35_000,
        limit: 50_000,
        deployment: { versionId: 'v-123', versionTag: 'deploy-tag' },
      },
    ]);
  });

  it('keeps enforcing when the signal emitter itself fails', async () => {
    const redis = countingRedis(
      new Map([['application-safety:verification-send', 699]]),
    );
    const budget = createRedisApplicationSafetyBudget(redis, policy, {
      emit() {
        throw new Error('emitter down');
      },
    });

    await expect(budget.consumeVerificationSend()).resolves.toEqual({
      allowed: true,
    });
  });

  it('rejects malformed budget responses instead of assuming success', async () => {
    const budget = createRedisApplicationSafetyBudget(
      { eval: () => Promise.resolve('OK') },
      policy,
    );

    await expect(budget.consumeVerificationSend()).rejects.toThrow(
      'Invalid application safety budget response',
    );
  });

  it('rejects a non-positive policy at construction', () => {
    expect(() =>
      createRedisApplicationSafetyBudget(
        { eval: () => Promise.resolve([1, 0, 1]) },
        { ...policy, sendLimit: 0 },
      ),
    ).toThrow('sendLimit');
  });

  it('provides an explicit unlimited budget for compositions without one', async () => {
    const budget = createUnlimitedApplicationSafetyBudget();

    await expect(budget.consumeVerificationSend()).resolves.toEqual({
      allowed: true,
    });
    await expect(budget.consumeAccountWrite()).resolves.toEqual({
      allowed: true,
    });
  });
});
