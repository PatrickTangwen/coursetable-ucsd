import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import type { UcsdAuthStore } from './ucsdAuth.store.js';
import { appUsers, emailVerificationCodes } from '../../drizzle/schema.js';
import { db } from '../config.js';

export function createDatabaseUcsdAuthStore(): UcsdAuthStore {
  return {
    async createVerification(record) {
      await db.insert(emailVerificationCodes).values(record);
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
      if (!verification) return false;

      await db
        .update(emailVerificationCodes)
        .set({ consumedAt: now })
        .where(eq(emailVerificationCodes.id, verification.id));
      return true;
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
