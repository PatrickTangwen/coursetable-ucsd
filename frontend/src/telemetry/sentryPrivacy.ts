const completeEmailPattern =
  /[\w.!#$%&'*+/=?^`{|}~-]{1,64}@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?){1,10}/giu;
const connectionStringPattern =
  /\b(?:postgres(?:ql)?|redis|mysql|mongodb(?:\+srv)?):\/\/\S+/giu;
const verificationCodePattern = /\b\d{6}\b/gu;
const verificationHashPattern = /\b[a-f\d]{32,}\b/giu;
const sensitiveKeyPattern =
  /(?:^|_)(?:api_?key|authorization|body|code|code_?hash|connection_?string|cookie|credential|database_?url|db_?url|email|headers|password|request_?body|secret|session|session_?id|token)$/iu;

export function scrubBrowserTelemetry<T>(value: T): T {
  return scrubValue(value, new WeakSet()) as T;
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[REDACTED_CYCLE]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => scrubValue(item, seen));

  const scrubbed: { [key: PropertyKey]: unknown } = {};
  for (const key of Reflect.ownKeys(value)) {
    const item = (value as { [key: PropertyKey]: unknown })[key];
    if (
      typeof key === 'string' &&
      sensitiveKeyPattern.test(
        key.replace(/(?<=[a-z])(?=[A-Z])/gu, '_').toLowerCase(),
      )
    )
      continue;
    scrubbed[key] = scrubValue(item, seen);
  }
  return scrubbed;
}

function scrubString(value: string) {
  const scrubbed = value
    .replace(completeEmailPattern, '[REDACTED_EMAIL]')
    .replace(connectionStringPattern, '[REDACTED_CONNECTION_STRING]')
    .replace(verificationCodePattern, '[REDACTED_VERIFICATION_CODE]')
    .replace(verificationHashPattern, '[REDACTED_VERIFICATION_HASH]');
  const normalized = scrubbed.toLowerCase();
  if (normalized.includes('authorization:') || normalized.includes('bearer '))
    return '[REDACTED_AUTHORIZATION]';
  if (
    normalized.includes('cookie:') ||
    normalized.includes('cookie=') ||
    normalized.includes('set-cookie:')
  )
    return '[REDACTED_COOKIE]';
  return scrubbed;
}
