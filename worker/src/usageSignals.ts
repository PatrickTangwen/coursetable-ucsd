import type { UpstashRedisCommands } from './upstashRedis.js';
import {
  classifyUsageLevel,
  type UsageLevel,
} from '../../api/src/core/usageLevels.js';
import { scrubGeneralTelemetry } from '../../api/src/telemetry/privacy.js';

export type UsageProvider = 'workers' | 'r2' | 'neon' | 'upstash' | 'resend';

export type UsageAllowances = { [provider in UsageProvider]: number };

export interface UsageDeploymentIdentity {
  versionId: string;
  versionTag: string;
}

export interface UsageSignal {
  signal: 'usage-signal';
  provider: UsageProvider;
  level: Exclude<UsageLevel, 'ok'>;
  used: number;
  allowance: number;
  month: string;
  deployment?: UsageDeploymentIdentity;
}

export interface UsageReport {
  provider: UsageProvider;
  level: UsageLevel;
  used: number;
  allowance: number;
  month: string;
}

export interface UsageSignals {
  record: (counts: Partial<UsageAllowances>) => Promise<void>;
  evaluate: () => Promise<UsageReport[]>;
}

interface UsageSignalOptions {
  allowances: UsageAllowances;
  now?: () => number;
  emit?: (signal: UsageSignal) => void;
  deployment?: UsageDeploymentIdentity;
}

const usageProviders: readonly UsageProvider[] = [
  'workers',
  'r2',
  'neon',
  'upstash',
  'resend',
];

// Counters outlive their calendar month long enough for a maintainer to
// review the previous month, then expire on their own.
const usageCounterExpiryMs = 40 * 24 * 60 * 60 * 1000;

// One request records every touched provider in a single Upstash command,
// so usage recording itself costs exactly the one command the caller
// accounts for in the upstash counter.
const usageCounterScript = `
local counts = {}
for index = 1, #KEYS do
  local count = redis.call('INCRBY', KEYS[index], ARGV[index])
  if count == tonumber(ARGV[index]) then
    redis.call('PEXPIRE', KEYS[index], ARGV[#ARGV])
  end
  counts[index] = count
end
return counts
`;

export function createRedisUsageSignals(
  redis: Pick<UpstashRedisCommands, 'eval' | 'get'>,
  options: UsageSignalOptions,
): UsageSignals {
  const { allowances, deployment } = options;
  const now = options.now ?? Date.now;
  const emit =
    options.emit ??
    ((signal: UsageSignal) =>
      console.warn(JSON.stringify(scrubGeneralTelemetry(signal))));
  for (const provider of usageProviders) {
    const allowance = allowances[provider];
    if (!Number.isSafeInteger(allowance) || allowance <= 0)
      throw new Error(`Usage allowance ${provider} must be positive`);
  }

  const month = (epochMs: number) =>
    new Date(epochMs).toISOString().slice(0, 7);

  return {
    // Usage signals are advisory. A failing signal store must never change
    // request behavior, so recording swallows its own failures.
    async record(counts) {
      const currentMonth = month(now());
      const recorded = usageProviders.filter(
        (provider) => (counts[provider] ?? 0) > 0,
      );
      if (!recorded.length) return;
      try {
        const result = await redis.eval(
          usageCounterScript,
          recorded.map((provider) => `usage:${provider}:${currentMonth}`),
          [
            ...recorded.map((provider) => String(counts[provider])),
            String(usageCounterExpiryMs),
          ],
        );
        if (!Array.isArray(result)) return;
        recorded.forEach((provider, index) => {
          const used = Number(result[index]);
          if (!Number.isFinite(used)) return;
          const increment = counts[provider]!;
          const allowance = allowances[provider];
          const level = classifyUsageLevel(used, allowance);
          const previousLevel = classifyUsageLevel(used - increment, allowance);
          if (level !== 'ok' && level !== previousLevel) {
            emit({
              signal: 'usage-signal',
              provider,
              level,
              used,
              allowance,
              month: currentMonth,
              ...(deployment ? { deployment } : {}),
            });
          }
        });
      } catch {
        // Signal loss is acceptable; failing a request for it is not.
      }
    },
    async evaluate() {
      const currentMonth = month(now());
      const reports: UsageReport[] = [];
      for (const provider of usageProviders) {
        const stored = await redis.get<number | string>(
          `usage:${provider}:${currentMonth}`,
        );
        const used = stored === null ? 0 : Number(stored);
        const allowance = allowances[provider];
        reports.push({
          provider,
          level: classifyUsageLevel(used, allowance),
          used,
          allowance,
          month: currentMonth,
        });
      }
      return reports;
    },
  };
}
