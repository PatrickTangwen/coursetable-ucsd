import { and, desc, eq, gt, lte } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import {
  allowlistedEmailDeliveryAuditRecord,
  parseEmailDeliveryOutcome,
  type EmailDeliveryAuditStore,
} from './emailDeliveryAudit.store.js';
import * as schema from '../../drizzle/schema.js';

const { emailDeliveryAudits } = schema;
type EmailDeliveryAuditDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabaseEmailDeliveryAuditStore(
  db: EmailDeliveryAuditDatabase,
): EmailDeliveryAuditStore {
  return {
    async recordRequest(record) {
      const allowlisted = allowlistedEmailDeliveryAuditRecord(record);
      await db
        .insert(emailDeliveryAudits)
        .values(allowlisted)
        .onConflictDoNothing({ target: emailDeliveryAudits.requestId });
    },
    async recordOutcome(requestId, deliveryOutcome, providerMessageId) {
      const updated = await db
        .update(emailDeliveryAudits)
        .set({ deliveryOutcome, providerMessageId })
        .where(eq(emailDeliveryAudits.requestId, requestId))
        .returning({ requestId: emailDeliveryAudits.requestId });
      if (!updated.length) throw new Error('Email Delivery Audit not found');
    },
    async findRecentByRecipient(normalizedRecipientEmail, now) {
      const records = await db.query.emailDeliveryAudits.findMany({
        where: and(
          eq(
            emailDeliveryAudits.normalizedRecipientEmail,
            normalizedRecipientEmail,
          ),
          gt(emailDeliveryAudits.expiresAt, now),
        ),
        columns: {
          normalizedRecipientEmail: true,
          requestId: true,
          providerMessageId: true,
          requestTime: true,
          deliveryOutcome: true,
          expiresAt: true,
        },
        orderBy: [desc(emailDeliveryAudits.requestTime)],
      });
      return records.map((record) => ({
        ...record,
        deliveryOutcome: parseEmailDeliveryOutcome(record.deliveryOutcome),
      }));
    },
    async deleteExpired(now) {
      const deleted = await db
        .delete(emailDeliveryAudits)
        .where(lte(emailDeliveryAudits.expiresAt, now))
        .returning({ requestId: emailDeliveryAudits.requestId });
      return deleted.length;
    },
  };
}
