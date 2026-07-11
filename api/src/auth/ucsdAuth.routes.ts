import type express from 'express';
import asyncHandler from 'express-async-handler';
import z from 'zod';

import { establishAppSession, getAppSessionUser } from './ucsdAuth.session.js';
import type { UcsdAuthStore } from './ucsdAuth.store.js';
import {
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

const RequestVerificationSchema = z.object({
  email: z.string().min(1).max(256),
});

const CompleteVerificationSchema = z.object({
  email: z.string().min(1).max(256),
  code: z.string().regex(/^\d{6}$/u),
});

export interface UcsdAuthRoutesOptions {
  store: UcsdAuthStore;
  emailSender: VerificationEmailSender;
  exposeVerificationCode?: boolean;
  codeGenerator?: () => string;
  now?: () => number;
  requestCooldownMs?: number;
  requestLimiter?: VerificationRequestLimiter;
  requestSource?: (req: express.Request) => string;
  verificationAttemptLimiter?: VerificationAttemptLimiter;
}

function appUserPayload(req: express.Request) {
  const user = getAppSessionUser(req);
  if (!user) return { authenticated: false as const, user: null };
  return {
    authenticated: true as const,
    user: toAppUserResponse(user),
  };
}

function invalidEmailResponse(res: express.Response) {
  res.status(400).json({
    error: 'NON_UCSD_EMAIL',
    message: 'Use a UCSD email address ending in @ucsd.edu.',
  });
}

function destroySession(req: express.Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function registerUcsdAuthRoutes(
  app: express.Express,
  {
    store,
    emailSender,
    exposeVerificationCode = false,
    codeGenerator = createVerificationCode,
    now = Date.now,
    requestCooldownMs = 60_000,
    requestLimiter = createUnlimitedVerificationRequestLimiter(),
    requestSource = (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
    verificationAttemptLimiter = createUnlimitedVerificationAttemptLimiter(),
  }: UcsdAuthRoutesOptions,
): void {
  app.get('/api/auth/current-user', (req, res) => {
    res.json(appUserPayload(req));
  });

  app.post(
    '/api/auth/ucsd/request-verification',
    asyncHandler(async (req, res) => {
      const parsed = RequestVerificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_REQUEST' });
        return;
      }

      const normalizedEmail = normalizeVerifiedUcsdEmail(parsed.data.email);
      if (!normalizedEmail) {
        invalidEmailResponse(res);
        return;
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
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((reservation.retryAt - createdAt) / 1000),
        );
        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error:
            reservation.reason === 'pending'
              ? 'VERIFICATION_REQUEST_PENDING'
              : 'VERIFICATION_COOLDOWN',
          message:
            reservation.reason === 'pending'
              ? 'A verification request is already being processed.'
              : 'Wait before requesting another verification code.',
          retryAfterSeconds,
        });
        return;
      }

      const requestLimit = await requestLimiter
        .attempt(requestSource(req))
        .catch(() => null);
      if (!requestLimit) {
        await store.markVerificationFailed(reservation.verificationId);
        res.status(503).json({
          error: 'VERIFICATION_REQUEST_UNAVAILABLE',
          message: 'Verification requests are temporarily unavailable.',
        });
        return;
      }
      if (!requestLimit.allowed) {
        await store.markVerificationFailed(reservation.verificationId);
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(requestLimit.retryAfterMs / 1000),
        );
        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: 'VERIFICATION_RATE_LIMIT',
          message: 'Too many verification requests. Try again later.',
          retryAfterSeconds,
        });
        return;
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
        if (
          error instanceof VerificationEmailDeliveryError &&
          error.outcome === 'definitive_failure'
        )
          await store.markVerificationFailed(reservation.verificationId);

        res.status(503).json({
          error:
            error instanceof VerificationEmailDeliveryError &&
            error.outcome === 'definitive_failure'
              ? 'VERIFICATION_DELIVERY_FAILED'
              : 'VERIFICATION_DELIVERY_UNCERTAIN',
          message:
            error instanceof VerificationEmailDeliveryError &&
            error.outcome === 'definitive_failure'
              ? 'Verification email could not be sent. Try again shortly.'
              : 'Email delivery is still being confirmed. Use the first code if it arrives.',
        });
        return;
      }

      try {
        await store.markVerificationSent(reservation.verificationId);
      } catch {
        res.status(503).json({
          error: 'VERIFICATION_DELIVERY_UNCERTAIN',
          message:
            'Email delivery is still being confirmed. Use the first code if it arrives.',
        });
        return;
      }

      res.json({
        status: 'verification_sent',
        email: normalizedEmail,
        ...(exposeVerificationCode ? { devCode: code } : {}),
      });
    }),
  );

  app.post(
    '/api/auth/ucsd/verify',
    asyncHandler(async (req, res) => {
      const parsed = CompleteVerificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_REQUEST' });
        return;
      }

      const normalizedEmail = normalizeVerifiedUcsdEmail(parsed.data.email);
      if (!normalizedEmail) {
        invalidEmailResponse(res);
        return;
      }

      const attemptLimit = await verificationAttemptLimiter
        .attempt(requestSource(req), normalizedEmail)
        .catch(() => null);
      if (!attemptLimit) {
        res.status(503).json({
          error: 'VERIFICATION_REQUEST_UNAVAILABLE',
          message: 'Verification is temporarily unavailable.',
        });
        return;
      }
      if (!attemptLimit.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(attemptLimit.retryAfterMs / 1000),
        );
        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: 'VERIFICATION_ATTEMPT_LIMIT',
          message: 'Too many verification attempts. Try again later.',
          retryAfterSeconds,
        });
        return;
      }

      const consumption = await store.consumeVerification(
        normalizedEmail,
        hashVerificationCode(normalizedEmail, parsed.data.code),
        now(),
      );
      if (consumption !== 'consumed') {
        const expired = consumption === 'expired_or_consumed';
        res.status(400).json({
          error: expired
            ? 'VERIFICATION_CODE_EXPIRED'
            : 'INVALID_VERIFICATION_CODE',
          message: expired
            ? 'Verification code has expired or was already used.'
            : 'Verification code is incorrect.',
        });
        return;
      }

      const user = await store.findOrCreateUser(normalizedEmail, now());
      await verificationAttemptLimiter
        .resetEmail(normalizedEmail)
        .catch(() => {});
      await establishAppSession(req, user);
      res.json({
        authenticated: true,
        user: toAppUserResponse(user),
      });
    }),
  );

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      if (typeof req.logOut === 'function') {
        req.logOut((err) => {
          if (err) next(err);
        });
      }
      res.clearCookie('connect.sid');
      await destroySession(req);
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  });
}
