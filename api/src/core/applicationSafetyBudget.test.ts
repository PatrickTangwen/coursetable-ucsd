import { describe, expect, it } from 'vitest';

import {
  createRedisApplicationSafetyBudget,
  createUnlimitedApplicationSafetyBudget,
} from './applicationSafetyBudget.js';

const policy = {
  sendLimit: 1000,
  sendWindowMs: 2_592_000_000,
  accountWriteLimit: 50_000,
  accountWriteWindowMs: 2_592_000_000,
};

describe('application safety budget', () => {
  it('consumes dedicated send and account-write budgets with configured policy', async () => {
    const calls: unknown[] = [];
    const budget = createRedisApplicationSafetyBudget(
      {
        eval(_script, options) {
          calls.push(options);
          return Promise.resolve([1, 0]);
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
      { eval: () => Promise.resolve([0, 86_400_000]) },
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
        { eval: () => Promise.resolve([1, 0]) },
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
