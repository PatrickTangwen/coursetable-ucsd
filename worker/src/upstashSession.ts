import type { AuthHttpSession } from '../../api/src/auth/ucsdAuth.response.js';
import type { AppUserIdentity } from '../../api/src/auth/ucsdIdentity.js';

export interface UpstashSessionRedis {
  del: (key: string) => Promise<number>;
  get: <T>(key: string) => Promise<T | null>;
  setex: (key: string, seconds: number, value: string) => Promise<unknown>;
}

const cookieName = 'sungrid_session';
const sessionTtlSeconds = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

export function createUpstashAppSession(
  redis: UpstashSessionRedis,
  secret: string,
): AuthHttpSession {
  if (!secret.trim()) throw new Error('Worker session secret is required');

  return {
    async getUser(context) {
      const request = context as Request;
      const sessionId = await readSessionId(request, secret);
      if (!sessionId) return null;
      const stored = await redis.get<AppUserIdentity | string>(
        sessionKey(sessionId),
      );
      if (!stored) return null;
      return typeof stored === 'string'
        ? (JSON.parse(stored) as AppUserIdentity)
        : stored;
    },
    async establish(context, user, responseHeaders) {
      const previousSessionId = await readSessionId(context as Request, secret);
      if (previousSessionId) await redis.del(sessionKey(previousSessionId));
      const sessionId = randomSessionId();
      await redis.setex(
        sessionKey(sessionId),
        sessionTtlSeconds,
        JSON.stringify(user),
      );
      const signature = await sign(sessionId, secret);
      responseHeaders.append(
        'set-cookie',
        `${cookieName}=${sessionId}.${signature}; Max-Age=${sessionTtlSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      );
    },
    async destroy(context, responseHeaders) {
      const request = context as Request;
      const sessionId = await readSessionId(request, secret);
      if (sessionId) await redis.del(sessionKey(sessionId));
      responseHeaders.append(
        'set-cookie',
        `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
      );
    },
  };
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

function randomSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readSessionId(request: Request, secret: string) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!value) return null;
  const [sessionId, suppliedSignature, ...rest] = value.split('.');
  if (!sessionId || !suppliedSignature || rest.length) return null;
  const expectedSignature = await sign(sessionId, secret);
  return constantTimeEqual(suppliedSignature, expectedSignature)
    ? sessionId
    : null;
}

async function sign(sessionId: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sessionId),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  let encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_');
  while (encoded.endsWith('=')) encoded = encoded.slice(0, -1);
  return encoded;
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
