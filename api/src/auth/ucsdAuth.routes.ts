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
  type VerificationEmailSender,
} from './verificationEmail.sender.js';

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
      if (reservation.status === 'cooldown') {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((reservation.retryAt - createdAt) / 1000),
        );
        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: 'VERIFICATION_COOLDOWN',
          message: 'Wait before requesting another verification code.',
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
      } catch {
        res.status(503).json({
          error: 'VERIFICATION_DELIVERY_FAILED',
          message: 'Verification email could not be sent. Try again shortly.',
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
