import z from 'zod';

import type { UcsdAuthStore } from './ucsdAuth.store.js';
import {
  type AppUserIdentity,
  createVerificationCode,
  hashVerificationCode,
  normalizeVerifiedUcsdEmail,
  toAppUserResponse,
  verificationCodeTtlMs,
} from './ucsdIdentity.js';
import {
  createVerificationEmailMessage,
  VerificationEmailDeliveryError,
  type VerificationEmailSender,
} from './verificationEmail.sender.js';
import {
  createUnlimitedVerificationAttemptLimiter,
  createUnlimitedVerificationRequestLimiter,
  type VerificationAttemptLimiter,
  type VerificationRequestLimiter,
} from './verificationRequest.limiter.js';
import {
  createUnlimitedApplicationSafetyBudget,
  type ApplicationSafetyBudget,
} from '../core/applicationSafetyBudget.js';

const RequestVerificationSchema = z.object({
  email: z.string().min(1).max(256),
});

const CompleteVerificationSchema = z.object({
  email: z.string().min(1).max(256),
  code: z.string().regex(/^\d{6}$/u),
});

export interface AuthHttpSession {
  destroy: (context: unknown, responseHeaders: Headers) => Promise<void>;
  establish: (
    context: unknown,
    user: AppUserIdentity,
    responseHeaders: Headers,
  ) => Promise<void>;
  getUser: (context: unknown) => Promise<AppUserIdentity | null>;
}

export interface UcsdAuthHttpRequest {
  body?: unknown;
  context: unknown;
  method: string;
  pathname: string;
  source: string;
}

export interface UcsdAuthHttpOptions {
  store: UcsdAuthStore;
  emailSender: VerificationEmailSender;
  session: AuthHttpSession;
  exposeVerificationCode?: boolean;
  codeGenerator?: () => string;
  now?: () => number;
  requestCooldownMs?: number;
  requestLimiter?: VerificationRequestLimiter;
  verificationAttemptLimiter?: VerificationAttemptLimiter;
  safetyBudget?: ApplicationSafetyBudget;
}

export async function createUcsdAuthResponse(
  request: UcsdAuthHttpRequest,
  {
    store,
    emailSender,
    session,
    exposeVerificationCode = false,
    codeGenerator = createVerificationCode,
    now = Date.now,
    requestCooldownMs = 60_000,
    requestLimiter = createUnlimitedVerificationRequestLimiter(),
    verificationAttemptLimiter = createUnlimitedVerificationAttemptLimiter(),
    safetyBudget = createUnlimitedApplicationSafetyBudget(),
  }: UcsdAuthHttpOptions,
): Promise<Response | null> {
  const responseHeaders = new Headers({ 'cache-control': 'no-store' });

  if (
    request.method === 'GET' &&
    request.pathname === '/api/auth/current-user'
  ) {
    const user = await session.getUser(request.context);
    return jsonResponse(
      user
        ? { authenticated: true, user: toAppUserResponse(user) }
        : { authenticated: false, user: null },
      200,
      responseHeaders,
    );
  }

  if (
    request.method === 'POST' &&
    request.pathname === '/api/auth/ucsd/request-verification'
  ) {
    const parsed = RequestVerificationSchema.safeParse(request.body);
    if (!parsed.success)
      return jsonResponse({ error: 'INVALID_REQUEST' }, 400, responseHeaders);

    const normalizedEmail = normalizeVerifiedUcsdEmail(parsed.data.email);
    if (!normalizedEmail) return invalidEmailResponse(responseHeaders);

    const sourceAdmission = await requestLimiter
      .admitSource(request.source)
      .catch(() => null);
    if (!sourceAdmission) {
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification requests are temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!sourceAdmission.allowed) {
      return limitedResponse(
        'VERIFICATION_RATE_LIMIT',
        'Too many verification requests. Try again later.',
        sourceAdmission.retryAfterMs,
        responseHeaders,
      );
    }

    const sendPreflight = await requestLimiter
      .preflightSend()
      .catch(() => null);
    if (!sendPreflight) {
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification requests are temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!sendPreflight.allowed) {
      return limitedResponse(
        'VERIFICATION_RATE_LIMIT',
        'Too many verification requests. Try again later.',
        sendPreflight.retryAfterMs,
        responseHeaders,
      );
    }

    const safetyPreflight = await safetyBudget
      .preflightVerificationSend()
      .catch(() => null);
    if (!safetyPreflight) {
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification requests are temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!safetyPreflight.allowed) {
      return unavailableResponse(
        'VERIFICATION_SENDS_PAUSED',
        'New verification emails are temporarily paused.',
        responseHeaders,
      );
    }

    const code = codeGenerator();
    const createdAt = now();
    const expiresAt = createdAt + verificationCodeTtlMs;
    const reservation = await store.reserveVerification(
      {
        normalizedEmail,
        codeHash: hashVerificationCode(normalizedEmail, code),
        createdAt,
        expiresAt,
      },
      requestCooldownMs,
    );
    if (reservation.status === 'blocked') {
      return limitedResponse(
        reservation.reason === 'pending'
          ? 'VERIFICATION_REQUEST_PENDING'
          : 'VERIFICATION_COOLDOWN',
        reservation.reason === 'pending'
          ? 'A verification request is already being processed.'
          : 'Wait before requesting another verification code.',
        reservation.retryAt - createdAt,
        responseHeaders,
      );
    }

    const requestLimit = await requestLimiter.consumeSend().catch(() => null);
    if (!requestLimit) {
      await store.markVerificationFailed(reservation.verificationId);
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification requests are temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!requestLimit.allowed) {
      await store.markVerificationFailed(reservation.verificationId);
      return limitedResponse(
        'VERIFICATION_RATE_LIMIT',
        'Too many verification requests. Try again later.',
        requestLimit.retryAfterMs,
        responseHeaders,
      );
    }

    const safetyAdmission = await safetyBudget
      .consumeVerificationSend()
      .catch(() => null);
    if (!safetyAdmission) {
      await store.markVerificationFailed(reservation.verificationId);
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification requests are temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!safetyAdmission.allowed) {
      await store.markVerificationFailed(reservation.verificationId);
      return unavailableResponse(
        'VERIFICATION_SENDS_PAUSED',
        'New verification emails are temporarily paused.',
        responseHeaders,
      );
    }

    try {
      await emailSender.sendVerificationEmail(
        createVerificationEmailMessage({
          deliveryId: `verification/${createdAt}/${reservation.verificationId}`,
          email: normalizedEmail,
          code,
          createdAt,
          expiresAt,
        }),
      );
    } catch (error) {
      const definitive =
        error instanceof VerificationEmailDeliveryError &&
        error.outcome === 'definitive_failure';
      if (definitive)
        await store.markVerificationFailed(reservation.verificationId);
      return unavailableResponse(
        definitive
          ? 'VERIFICATION_DELIVERY_FAILED'
          : 'VERIFICATION_DELIVERY_UNCERTAIN',
        definitive
          ? 'Verification email could not be sent. Try again shortly.'
          : 'Email delivery is still being confirmed. Use the first code if it arrives.',
        responseHeaders,
      );
    }

    try {
      await store.markVerificationSent(reservation.verificationId);
    } catch {
      return unavailableResponse(
        'VERIFICATION_DELIVERY_UNCERTAIN',
        'Email delivery is still being confirmed. Use the first code if it arrives.',
        responseHeaders,
      );
    }

    return jsonResponse(
      {
        status: 'verification_sent',
        email: normalizedEmail,
        ...(exposeVerificationCode ? { devCode: code } : {}),
      },
      200,
      responseHeaders,
    );
  }

  if (
    request.method === 'POST' &&
    request.pathname === '/api/auth/ucsd/verify'
  ) {
    const parsed = CompleteVerificationSchema.safeParse(request.body);
    if (!parsed.success)
      return jsonResponse({ error: 'INVALID_REQUEST' }, 400, responseHeaders);

    const normalizedEmail = normalizeVerifiedUcsdEmail(parsed.data.email);
    if (!normalizedEmail) return invalidEmailResponse(responseHeaders);

    const attemptLimit = await verificationAttemptLimiter
      .attempt(request.source, normalizedEmail)
      .catch(() => null);
    if (!attemptLimit) {
      return unavailableResponse(
        'VERIFICATION_REQUEST_UNAVAILABLE',
        'Verification is temporarily unavailable.',
        responseHeaders,
      );
    }
    if (!attemptLimit.allowed) {
      return limitedResponse(
        'VERIFICATION_ATTEMPT_LIMIT',
        'Too many verification attempts. Try again later.',
        attemptLimit.retryAfterMs,
        responseHeaders,
      );
    }

    const consumption = await store.consumeVerification(
      normalizedEmail,
      hashVerificationCode(normalizedEmail, parsed.data.code),
      now(),
    );
    if (consumption !== 'consumed') {
      const expired = consumption === 'expired_or_consumed';
      return jsonResponse(
        {
          error: expired
            ? 'VERIFICATION_CODE_EXPIRED'
            : 'INVALID_VERIFICATION_CODE',
          message: expired
            ? 'Verification code has expired or was already used.'
            : 'Verification code is incorrect.',
        },
        400,
        responseHeaders,
      );
    }

    const user = await store.findOrCreateUser(normalizedEmail, now());
    await verificationAttemptLimiter
      .resetEmail(normalizedEmail)
      .catch(() => {});
    await session.establish(request.context, user, responseHeaders);
    return jsonResponse(
      { authenticated: true, user: toAppUserResponse(user) },
      200,
      responseHeaders,
    );
  }

  if (request.method === 'POST' && request.pathname === '/api/auth/logout') {
    await session.destroy(request.context, responseHeaders);
    return new Response(null, { status: 200, headers: responseHeaders });
  }

  return null;
}

function invalidEmailResponse(headers: Headers) {
  return jsonResponse(
    {
      error: 'NON_UCSD_EMAIL',
      message: 'Use a UCSD email address ending in @ucsd.edu.',
    },
    400,
    headers,
  );
}

function unavailableResponse(error: string, message: string, headers: Headers) {
  return jsonResponse({ error, message }, 503, headers);
}

function limitedResponse(
  error: string,
  message: string,
  retryAfterMs: number,
  headers: Headers,
) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  headers.set('retry-after', String(retryAfterSeconds));
  return jsonResponse({ error, message, retryAfterSeconds }, 429, headers);
}

function jsonResponse(body: unknown, status: number, headers: Headers) {
  headers.set('content-type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}
