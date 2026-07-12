import {
  consumeSingleBudget,
  type BudgetAdmission,
  type RedisEvalClient,
} from '../auth/verificationRequest.limiter.js';

export interface ApplicationSafetyBudgetPolicy {
  sendLimit: number;
  sendWindowMs: number;
  accountWriteLimit: number;
  accountWriteWindowMs: number;
}

export interface ApplicationSafetyBudget {
  consumeVerificationSend: () => Promise<BudgetAdmission>;
  consumeAccountWrite: () => Promise<BudgetAdmission>;
}

export function createRedisApplicationSafetyBudget(
  redis: RedisEvalClient,
  policy: ApplicationSafetyBudgetPolicy,
): ApplicationSafetyBudget {
  for (const [name, value] of Object.entries(policy)) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Application safety budget ${name} must be positive`);
  }

  return {
    consumeVerificationSend: () =>
      consumeSingleBudget(
        redis,
        'application-safety:verification-send',
        policy.sendLimit,
        policy.sendWindowMs,
        'Invalid application safety budget response',
      ),
    consumeAccountWrite: () =>
      consumeSingleBudget(
        redis,
        'application-safety:account-write',
        policy.accountWriteLimit,
        policy.accountWriteWindowMs,
        'Invalid application safety budget response',
      ),
  };
}

export function createUnlimitedApplicationSafetyBudget(): ApplicationSafetyBudget {
  return {
    consumeVerificationSend: () => Promise.resolve({ allowed: true }),
    consumeAccountWrite: () => Promise.resolve({ allowed: true }),
  };
}
