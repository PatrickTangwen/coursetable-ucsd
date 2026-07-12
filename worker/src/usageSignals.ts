import type { UpstashRedisCommands } from './upstashRedis.js';

export type UsageProvider = 'workers' | 'r2' | 'neon' | 'upstash' | 'resend';
export type UsageLevel = 'ok' | 'attention' | 'urgent';

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

const usageCounterScript = `
local count = redis.call('INCRBY', KEYS[1], ARGV[1])
if count == tonumber(ARGV[1]) then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return count
`;

export function classifyUsageLevel(
  used: number,
  allowance: number,
): UsageLevel {
  if (used >= allowance * 0.9) return 'urgent';
  if (used >= allowance * 0.7) return 'attention';
  return 'ok';
}

export function createRedisUsageSignals(
  redis: Pick<UpstashRedisCommands, 'eval' | 'get'>,
  options: UsageSignalOptions,
): UsageSignals {
  const { allowances, deployment } = options;
  const now = options.now ?? Date.now;
  const emit =
    options.emit ??
    ((signal: UsageSignal) => console.warn(JSON.stringify(signal)));
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
      for (const provider of usageProviders) {
        const increment = counts[provider];
        if (!increment) continue;
        try {
          const used = Number(
            await redis.eval(
              usageCounterScript,
              [`usage:${provider}:${currentMonth}`],
              [String(increment), String(usageCounterExpiryMs)],
            ),
          );
          if (!Number.isFinite(used)) continue;
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
        } catch {
          // Signal loss is acceptable; failing a request for it is not.
        }
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
