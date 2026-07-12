export interface RedisEvalClient {
  eval: (
    script: string,
    options: { keys: string[]; arguments: string[] },
  ) => Promise<unknown>;
}

export type BudgetAdmission =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export interface BudgetConsumption {
  admission: BudgetAdmission;
  // The counter value after this consumption, or null when the store
  // predates the counting script and only reports admission.
  used: number | null;
}

export const singleBudgetScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, math.max(redis.call('PTTL', KEYS[1]), 1), count}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, 0, count}
`;

export const inspectSingleBudgetScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, math.max(redis.call('PTTL', KEYS[1]), 1), count}
end
return {1, 0, count}
`;

function parseBudgetConsumption(
  result: unknown,
  invalidResponseMessage: string,
) {
  if (!Array.isArray(result) || result.length < 2 || result.length > 3)
    throw new Error(invalidResponseMessage);
  const allowed = Number(result[0]);
  const retryAfterMs = Number(result[1]);
  const used =
    result.length === 3 && Number.isFinite(Number(result[2]))
      ? Number(result[2])
      : null;
  if (allowed === 1) return { admission: { allowed: true } as const, used };
  if (allowed === 0 && Number.isFinite(retryAfterMs)) {
    return {
      admission: {
        allowed: false as const,
        retryAfterMs: Math.max(1, retryAfterMs),
      },
      used,
    };
  }
  throw new Error(invalidResponseMessage);
}

export async function inspectSingleBudget(
  redis: RedisEvalClient,
  key: string,
  limit: number,
  invalidResponseMessage: string,
): Promise<BudgetConsumption> {
  const result = await redis.eval(inspectSingleBudgetScript, {
    keys: [key],
    arguments: [String(limit)],
  });
  return parseBudgetConsumption(result, invalidResponseMessage);
}

export async function consumeSingleBudget(
  redis: RedisEvalClient,
  key: string,
  limit: number,
  windowMs: number,
  invalidResponseMessage: string,
): Promise<BudgetConsumption> {
  const result = await redis.eval(singleBudgetScript, {
    keys: [key],
    arguments: [String(limit), String(windowMs)],
  });
  return parseBudgetConsumption(result, invalidResponseMessage);
}
