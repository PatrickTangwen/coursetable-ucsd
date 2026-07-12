import {
  consumeSingleBudget,
  inspectSingleBudget,
  type BudgetAdmission,
  type RedisEvalClient,
} from './redisBudget.js';
import { classifyUsageLevel, type UsageLevel } from './usageLevels.js';
import { scrubGeneralTelemetry } from '../telemetry/privacy.js';

export interface ApplicationSafetyBudgetPolicy {
  sendLimit: number;
  sendWindowMs: number;
  accountWriteLimit: number;
  accountWriteWindowMs: number;
}

export interface SafetyBudgetDeploymentIdentity {
  versionId: string;
  versionTag: string;
}

export interface SafetyBudgetSignal {
  signal: 'safety-budget-signal';
  budget: 'verification-send' | 'account-write';
  level: Exclude<UsageLevel, 'ok'>;
  used: number;
  limit: number;
  deployment?: SafetyBudgetDeploymentIdentity;
}

export interface ApplicationSafetyBudgetOptions {
  emit?: (signal: SafetyBudgetSignal) => void;
  deployment?: SafetyBudgetDeploymentIdentity;
}

export interface ApplicationSafetyBudget {
  preflightVerificationSend: () => Promise<BudgetAdmission>;
  consumeVerificationSend: () => Promise<BudgetAdmission>;
  consumeAccountWrite: () => Promise<BudgetAdmission>;
}

export function createRedisApplicationSafetyBudget(
  redis: RedisEvalClient,
  policy: ApplicationSafetyBudgetPolicy,
  options: ApplicationSafetyBudgetOptions = {},
): ApplicationSafetyBudget {
  for (const [name, value] of Object.entries(policy)) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Application safety budget ${name} must be positive`);
  }
  const emit =
    options.emit ??
    ((signal: SafetyBudgetSignal) =>
      console.warn(JSON.stringify(scrubGeneralTelemetry(signal))));
  const { deployment } = options;

  const consume = async (
    budget: SafetyBudgetSignal['budget'],
    key: string,
    limit: number,
    windowMs: number,
  ) => {
    const { admission, used } = await consumeSingleBudget(
      redis,
      key,
      limit,
      windowMs,
      'Invalid application safety budget response',
    );
    if (admission.allowed && used !== null) {
      const level = classifyUsageLevel(used, limit);
      const previousLevel = classifyUsageLevel(used - 1, limit);
      if (level !== 'ok' && level !== previousLevel) {
        // Signals are advisory; a failing emitter must not fail enforcement.
        try {
          emit({
            signal: 'safety-budget-signal',
            budget,
            level,
            used,
            limit,
            ...(deployment ? { deployment } : {}),
          });
        } catch {
          // Signal loss is acceptable; failing the request for it is not.
        }
      }
    }
    return admission;
  };

  return {
    async preflightVerificationSend() {
      const { admission } = await inspectSingleBudget(
        redis,
        'application-safety:verification-send',
        policy.sendLimit,
        'Invalid application safety budget response',
      );
      return admission;
    },
    consumeVerificationSend: () =>
      consume(
        'verification-send',
        'application-safety:verification-send',
        policy.sendLimit,
        policy.sendWindowMs,
      ),
    consumeAccountWrite: () =>
      consume(
        'account-write',
        'application-safety:account-write',
        policy.accountWriteLimit,
        policy.accountWriteWindowMs,
      ),
  };
}

export function createUnlimitedApplicationSafetyBudget(): ApplicationSafetyBudget {
  return {
    preflightVerificationSend: () => Promise.resolve({ allowed: true }),
    consumeVerificationSend: () => Promise.resolve({ allowed: true }),
    consumeAccountWrite: () => Promise.resolve({ allowed: true }),
  };
}
