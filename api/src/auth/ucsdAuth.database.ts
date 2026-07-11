import { and, desc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import type { UcsdAuthStore } from './ucsdAuth.store.js';
import * as schema from '../../drizzle/schema.js';

const { appUsers, emailVerificationCodes } = schema;
type UcsdAuthDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabaseUcsdAuthStore(
  db: UcsdAuthDatabase,
): UcsdAuthStore {
  return {
    reserveVerification(record, cooldownMs) {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${record.normalizedEmail}))`,
        );
        const latest = await tx.query.emailVerificationCodes.findFirst({
          where: and(
            eq(emailVerificationCodes.normalizedEmail, record.normalizedEmail),
            or(
              and(
                eq(emailVerificationCodes.deliveryStatus, 'sent'),
                gt(
                  emailVerificationCodes.createdAt,
                  record.createdAt - cooldownMs,
                ),
              ),
              and(
                eq(emailVerificationCodes.deliveryStatus, 'pending'),
                gt(emailVerificationCodes.expiresAt, record.createdAt),
              ),
            ),
          ),
          columns: { createdAt: true, expiresAt: true, deliveryStatus: true },
          orderBy: [desc(emailVerificationCodes.createdAt)],
        });
        if (latest) {
          return {
            status: 'blocked' as const,
            reason:
              latest.deliveryStatus === 'pending'
                ? ('pending' as const)
                : ('cooldown' as const),
            retryAt:
              latest.deliveryStatus === 'pending'
                ? latest.expiresAt
                : latest.createdAt + cooldownMs,
          };
        }
        const [created] = await tx
          .insert(emailVerificationCodes)
          .values({ ...record, deliveryStatus: 'pending' })
          .returning({ id: emailVerificationCodes.id });
        if (!created) throw new Error('Failed to reserve verification email');
        return { status: 'created' as const, verificationId: created.id };
      });
    },
    async markVerificationSent(verificationId) {
      const updated = await db
        .update(emailVerificationCodes)
        .set({ deliveryStatus: 'sent' })
        .where(
          and(
            eq(emailVerificationCodes.id, verificationId),
            eq(emailVerificationCodes.deliveryStatus, 'pending'),
          ),
        )
        .returning({ id: emailVerificationCodes.id });
      if (!updated.length)
        throw new Error('Verification reservation is not pending');
    },
    async markVerificationFailed(verificationId) {
      await db
        .update(emailVerificationCodes)
        .set({ deliveryStatus: 'failed' })
        .where(
          and(
            eq(emailVerificationCodes.id, verificationId),
            eq(emailVerificationCodes.deliveryStatus, 'pending'),
          ),
        );
    },
    async consumeVerification(normalizedEmail, codeHash, now) {
      const verification = await db.query.emailVerificationCodes.findFirst({
        where: and(
          eq(emailVerificationCodes.normalizedEmail, normalizedEmail),
          eq(emailVerificationCodes.codeHash, codeHash),
          ne(emailVerificationCodes.deliveryStatus, 'failed'),
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
            ne(emailVerificationCodes.deliveryStatus, 'failed'),
          ),
          columns: { id: true },
        });
        return prior ? 'expired_or_consumed' : 'invalid';
      }

      const consumed = await db
        .update(emailVerificationCodes)
        .set({ consumedAt: now, deliveryStatus: 'sent' })
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
