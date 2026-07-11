import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import type { UcsdAuthStore } from './ucsdAuth.store.js';
import { appUsers, emailVerificationCodes } from '../../drizzle/schema.js';
import { db } from '../config.js';

export function createDatabaseUcsdAuthStore(): UcsdAuthStore {
  return {
    reserveVerification(record, cooldownMs) {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${record.normalizedEmail}))`,
        );
        const latest = await tx.query.emailVerificationCodes.findFirst({
          where: eq(
            emailVerificationCodes.normalizedEmail,
            record.normalizedEmail,
          ),
          columns: { createdAt: true },
          orderBy: [desc(emailVerificationCodes.createdAt)],
        });
        if (latest && latest.createdAt + cooldownMs > record.createdAt) {
          return {
            status: 'cooldown' as const,
            retryAt: latest.createdAt + cooldownMs,
          };
        }
        const [created] = await tx
          .insert(emailVerificationCodes)
          .values(record)
          .returning({ id: emailVerificationCodes.id });
        if (!created) throw new Error('Failed to reserve verification email');
        return { status: 'created' as const, verificationId: created.id };
      });
    },
    async consumeVerification(normalizedEmail, codeHash, now) {
      const verification = await db.query.emailVerificationCodes.findFirst({
        where: and(
          eq(emailVerificationCodes.normalizedEmail, normalizedEmail),
          eq(emailVerificationCodes.codeHash, codeHash),
          isNull(emailVerificationCodes.consumedAt),
          gt(emailVerificationCodes.expiresAt, now),
        ),
        columns: {
          id: true,
        },
        orderBy: [desc(emailVerificationCodes.createdAt)],
      });
      if (!verification) {
        const prior = await db.query.emailVerificationCodes.findFirst({
          where: and(
            eq(emailVerificationCodes.normalizedEmail, normalizedEmail),
            eq(emailVerificationCodes.codeHash, codeHash),
          ),
          columns: { id: true },
        });
        return prior ? 'expired_or_consumed' : 'invalid';
      }

      const consumed = await db
        .update(emailVerificationCodes)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationCodes.id, verification.id),
            isNull(emailVerificationCodes.consumedAt),
          ),
        )
        .returning({ id: emailVerificationCodes.id });
      return consumed.length ? 'consumed' : 'expired_or_consumed';
    },
    async findOrCreateUser(normalizedEmail, now) {
      const existing = await db.query.appUsers.findFirst({
        where: eq(appUsers.verifiedEmail, normalizedEmail),
        columns: {
          id: true,
          verifiedEmail: true,
        },
      });
      if (existing) {
        await db
          .update(appUsers)
          .set({ updatedAt: now })
          .where(eq(appUsers.id, existing.id));
        return {
          user_id: existing.id,
          verified_email: existing.verifiedEmail,
        };
      }

      const [created] = await db
        .insert(appUsers)
        .values({
          verifiedEmail: normalizedEmail,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: appUsers.id,
          verifiedEmail: appUsers.verifiedEmail,
        });
      if (!created) throw new Error('Failed to create UCSD app user');
      return {
        user_id: created.id,
        verified_email: created.verifiedEmail,
      };
    },
  };
}
