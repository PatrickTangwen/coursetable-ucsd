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

const singleBudgetScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, math.max(redis.call('PTTL', KEYS[1]), 1), count}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, 0, count}
`;

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
  if (!Array.isArray(result) || result.length < 2 || result.length > 3)
    throw new Error(invalidResponseMessage);
  const allowed = Number(result[0]);
  const retryAfterMs = Number(result[1]);
  const used =
    result.length === 3 && Number.isFinite(Number(result[2]))
      ? Number(result[2])
      : null;
  if (allowed === 1) return { admission: { allowed: true }, used };
  if (allowed === 0 && Number.isFinite(retryAfterMs)) {
    return {
      admission: { allowed: false, retryAfterMs: Math.max(1, retryAfterMs) },
      used,
    };
  }
  throw new Error(invalidResponseMessage);
}
