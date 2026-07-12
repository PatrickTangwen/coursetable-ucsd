import crypto from 'node:crypto';

const completeEmailPattern =
  /[\w.!#$%&'*+/=?^`{|}~-]{1,64}@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?){1,10}/giu;
const connectionStringPattern =
  /\b(?:postgres(?:ql)?|redis|mysql|mongodb(?:\+srv)?):\/\/\S+/giu;
const verificationCodePattern = /\b\d{6}\b/gu;
const verificationHashPattern = /\b[a-f\d]{32,}\b/giu;

const sensitiveKeyPattern =
  /(?:^|_)(?:api_?key|authorization|body|code|code_?hash|connection_?string|cookie|credential|database_?url|db_?url|password|request_?body|secret|session|session_?id|token)$/iu;

function isSensitiveKey(key: string, path: string[], value: unknown) {
  if (typeof value === 'boolean') return false;
  const normalized = key.replace(/(?<=[a-z])(?=[A-Z])/gu, '_').toLowerCase();
  if (normalized.endsWith('_source') || normalized.endsWith('_fingerprint'))
    return false;
  if (sensitiveKeyPattern.test(normalized)) return true;
  return normalized === 'data' && path.at(-1)?.toLowerCase() === 'request';
}

function scrubString(value: string) {
  const scrubbed = value
    .replace(completeEmailPattern, (email) =>
      email.includes('***@') ? email : '[REDACTED_EMAIL]',
    )
    .replace(connectionStringPattern, '[REDACTED_CONNECTION_STRING]')
    .replace(verificationCodePattern, '[REDACTED_VERIFICATION_CODE]')
    .replace(verificationHashPattern, '[REDACTED_VERIFICATION_HASH]');
  if (containsAuthorizationMaterial(scrubbed))
    return '[REDACTED_AUTHORIZATION]';
  if (containsCookieMaterial(scrubbed)) return '[REDACTED_COOKIE]';
  if (containsSensitiveTextMaterial(scrubbed))
    return '[REDACTED_SENSITIVE_TEXT]';
  return scrubbed;
}

export function scrubGeneralTelemetry<T>(value: T): T {
  return scrubValue(value, [], () => {}) as T;
}

function scrubValue(
  value: unknown,
  path: string[],
  reportUnsafe: (unsafeValuePath: string[]) => void,
): unknown {
  if (typeof value === 'string') {
    const scrubbedString = scrubString(value);
    if (scrubbedString !== value) reportUnsafe(path);
    return scrubbedString;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      scrubValue(item, [...path, String(index)], reportUnsafe),
    );
  }
  if (!value || typeof value !== 'object') return value;

  const scrubbed: { [key: PropertyKey]: unknown } = {};
  for (const key of Reflect.ownKeys(value)) {
    const item = (value as { [key: PropertyKey]: unknown })[key];
    if (typeof key === 'string') {
      const itemPath = [...path, key];
      if (isSensitiveKey(key, path, item)) {
        reportUnsafe(itemPath);
        continue;
      }
      scrubbed[key] = scrubValue(item, itemPath, reportUnsafe);
    } else {
      scrubbed[key] = scrubValue(item, path, reportUnsafe);
    }
  }
  return scrubbed;
}

export function assertGeneralTelemetrySafe(value: unknown) {
  const report: { unsafePath?: string[] } = {};
  scrubValue(value, [], (unsafeValuePath) => {
    report.unsafePath ??= unsafeValuePath;
  });
  if (!report.unsafePath) return;
  const location = report.unsafePath.length
    ? report.unsafePath.join('.')
    : '<root>';
  throw new Error(`Unsafe general telemetry payload at ${location}`);
}

function containsAuthorizationMaterial(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('authorization:') ||
    normalized.includes('authorization=') ||
    normalized.includes('bearer ')
  );
}

function containsCookieMaterial(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('cookie:') ||
    normalized.includes('cookie=') ||
    normalized.includes('set-cookie:') ||
    normalized.includes('set-cookie=')
  );
}

function containsSensitiveTextMaterial(value: string) {
  const normalized = value.toLowerCase();
  return [
    'credential',
    'password',
    'secret',
    'session id',
    'session-id',
    'session_id',
    'sessionid',
  ].some((term) => normalized.includes(term));
}

export function createRecipientTelemetryReference(
  normalizedEmail: string,
  hmacKey: string,
) {
  if (!hmacKey.trim()) throw new Error('Telemetry HMAC key is required');
  const email = normalizedEmail.trim().toLowerCase();
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1)
    throw new Error('Normalized recipient email is required');

  return {
    maskedEmail: `${email.slice(0, 1)}***@${email.slice(separator + 1)}`,
    recipientRef: `recipient_${crypto
      .createHmac('sha256', hmacKey)
      .update(email)
      .digest('hex')
      .slice(0, 16)}`,
  };
}
