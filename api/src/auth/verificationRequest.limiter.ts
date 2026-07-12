import { createHmac } from 'node:crypto';

export interface VerificationRequestLimitPolicy {
  sourceLimit: number;
  sourceWindowMs: number;
  globalLimit: number;
  globalWindowMs: number;
}

export interface VerificationRequestLimiter {
  admitSource: (
    source: string,
  ) => Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
  consumeSend: () => Promise<
    { allowed: true } | { allowed: false; retryAfterMs: number }
  >;
}

export interface VerificationAttemptLimitPolicy {
  sourceLimit: number;
  sourceWindowMs: number;
  emailLimit: number;
  emailWindowMs: number;
}

export interface VerificationAttemptLimiter {
  attempt: (
    source: string,
    email: string,
  ) => Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
  resetEmail: (email: string) => Promise<void>;
}

export interface RedisEvalClient {
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

const singleBudgetScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, math.max(redis.call('PTTL', KEYS[1]), 1)}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, 0}
`;

const resetKeyScript = `return redis.call('DEL', KEYS[1])`;

function validatePolicy(policy: object) {
  for (const [name, value] of Object.entries(policy)) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
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
    async admitSource(source) {
      const sourceDigest = createHmac('sha256', secret)
        .update(source)
        .digest('hex');
      const result = await redis.eval(singleBudgetScript, {
        keys: [`verification-request:source:${sourceDigest}`],
        arguments: [String(policy.sourceLimit), String(policy.sourceWindowMs)],
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
    async consumeSend() {
      const result = await redis.eval(singleBudgetScript, {
        keys: ['verification-request:global'],
        arguments: [String(policy.globalLimit), String(policy.globalWindowMs)],
      });
      if (!Array.isArray(result) || result.length !== 2)
        throw new Error('Invalid verification send budget response');
      const allowed = Number(result[0]);
      const retryAfterMs = Number(result[1]);
      if (allowed === 1) return { allowed: true };
      if (allowed === 0 && Number.isFinite(retryAfterMs))
        return { allowed: false, retryAfterMs: Math.max(1, retryAfterMs) };
      throw new Error('Invalid verification send budget response');
    },
  };
}

export function createUnlimitedVerificationRequestLimiter(): VerificationRequestLimiter {
  return {
    admitSource: () => Promise.resolve({ allowed: true }),
    consumeSend: () => Promise.resolve({ allowed: true }),
  };
}

function digestKey(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createRedisVerificationAttemptLimiter(
  redis: RedisEvalClient,
  secret: string,
  policy: VerificationAttemptLimitPolicy,
): VerificationAttemptLimiter {
  if (!secret)
    throw new Error('Verification attempt limiter secret is required');
  validatePolicy(policy);

  const emailKey = (email: string) =>
    `verification-attempt:email:${digestKey(secret, email)}`;
  return {
    async attempt(source, email) {
      const result = await redis.eval(attemptScript, {
        keys: [
          `verification-attempt:source:${digestKey(secret, source)}`,
          emailKey(email),
        ],
        arguments: [
          String(policy.sourceLimit),
          String(policy.sourceWindowMs),
          String(policy.emailLimit),
          String(policy.emailWindowMs),
        ],
      });
      if (!Array.isArray(result) || result.length !== 2)
        throw new Error('Invalid verification attempt limiter response');
      const allowed = Number(result[0]);
      const retryAfterMs = Number(result[1]);
      if (allowed === 1) return { allowed: true };
      if (allowed === 0 && Number.isFinite(retryAfterMs))
        return { allowed: false, retryAfterMs: Math.max(1, retryAfterMs) };
      throw new Error('Invalid verification attempt limiter response');
    },
    async resetEmail(email) {
      await redis.eval(resetKeyScript, {
        keys: [emailKey(email)],
        arguments: [],
      });
    },
  };
}

export function createUnlimitedVerificationAttemptLimiter(): VerificationAttemptLimiter {
  return {
    attempt: () => Promise.resolve({ allowed: true }),
    resetEmail: () => Promise.resolve(),
  };
}
