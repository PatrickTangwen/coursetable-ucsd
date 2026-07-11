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
import type { VerificationEmailSender } from './verificationEmail.sender.js';

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
      await store.createVerification({
        normalizedEmail,
        codeHash: hashVerificationCode(normalizedEmail, code),
        createdAt,
        expiresAt,
      });
      await emailSender.sendVerificationEmail({
        email: normalizedEmail,
        code,
        expiresAt,
      });

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

      const consumed = await store.consumeVerification(
        normalizedEmail,
        hashVerificationCode(normalizedEmail, parsed.data.code),
        now(),
      );
      if (!consumed) {
        res.status(400).json({
          error: 'INVALID_VERIFICATION_CODE',
          message: 'Verification code is invalid or expired.',
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
