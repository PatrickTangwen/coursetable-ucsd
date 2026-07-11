import { createHmac } from 'node:crypto';

export interface VerificationRequestLimitPolicy {
  sourceLimit: number;
  sourceWindowMs: number;
  globalLimit: number;
  globalWindowMs: number;
}

export interface VerificationRequestLimiter {
  attempt: (
    source: string,
  ) => Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
}

interface RedisEvalClient {
  eval: (
    script: string,
    options: { keys: string[]; arguments: string[] },
  ) => Promise<unknown>;
}

const attemptScript = `
local sourceCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local globalCount = tonumber(redis.call('GET', KEYS[2]) or '0')
if sourceCount >= tonumber(ARGV[1]) or globalCount >= tonumber(ARGV[3]) then
  local retryAfter = 1
  if sourceCount >= tonumber(ARGV[1]) then
    retryAfter = math.max(retryAfter, redis.call('PTTL', KEYS[1]))
  end
  if globalCount >= tonumber(ARGV[3]) then
    retryAfter = math.max(retryAfter, redis.call('PTTL', KEYS[2]))
  end
  return {0, retryAfter}
end
sourceCount = redis.call('INCR', KEYS[1])
if sourceCount == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
globalCount = redis.call('INCR', KEYS[2])
if globalCount == 1 then redis.call('PEXPIRE', KEYS[2], ARGV[4]) end
return {1, 0}
`;

function validatePolicy(policy: VerificationRequestLimitPolicy) {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Verification request policy ${name} must be positive`);
  }
}

export function createRedisVerificationRequestLimiter(
  redis: RedisEvalClient,
  secret: string,
  policy: VerificationRequestLimitPolicy,
): VerificationRequestLimiter {
  if (!secret)
    throw new Error('Verification request limiter secret is required');
  validatePolicy(policy);

  return {
    async attempt(source) {
      const sourceDigest = createHmac('sha256', secret)
        .update(source)
        .digest('hex');
      const result = await redis.eval(attemptScript, {
        keys: [
          `verification-request:source:${sourceDigest}`,
          'verification-request:global',
        ],
        arguments: [
          String(policy.sourceLimit),
          String(policy.sourceWindowMs),
          String(policy.globalLimit),
          String(policy.globalWindowMs),
        ],
      });
      if (!Array.isArray(result) || result.length !== 2)
        throw new Error('Invalid verification request limiter response');
      const allowed = Number(result[0]);
      const retryAfterMs = Number(result[1]);
      if (allowed === 1) return { allowed: true };
      if (allowed === 0 && Number.isFinite(retryAfterMs))
        return { allowed: false, retryAfterMs: Math.max(1, retryAfterMs) };
      throw new Error('Invalid verification request limiter response');
    },
  };
}

export function createUnlimitedVerificationRequestLimiter(): VerificationRequestLimiter {
  return { attempt: () => Promise.resolve({ allowed: true }) };
}
