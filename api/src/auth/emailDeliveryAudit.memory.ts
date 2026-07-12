import {
  type EmailDeliveryAuditRecord,
  type EmailDeliveryAuditStore,
  allowlistedEmailDeliveryAuditRecord,
} from './emailDeliveryAudit.store.js';

export function createMemoryEmailDeliveryAuditStore(): EmailDeliveryAuditStore {
  const records = new Map<string, EmailDeliveryAuditRecord>();

  return {
    recordRequest(record) {
      try {
        const allowlisted = allowlistedEmailDeliveryAuditRecord(record);
        records.set(allowlisted.requestId, allowlisted);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      }
    },
    recordOutcome(requestId, deliveryOutcome, providerMessageId) {
      const record = records.get(requestId);
      if (!record)
        return Promise.reject(new Error('Email Delivery Audit not found'));
      records.set(requestId, {
        ...record,
        deliveryOutcome,
        providerMessageId,
      });
      return Promise.resolve();
    },
    findRecentByRecipient(normalizedRecipientEmail, now) {
      return Promise.resolve(
        [...records.values()]
          .filter(
            (record) =>
              record.normalizedRecipientEmail === normalizedRecipientEmail &&
              record.expiresAt > now,
          )
          .sort((a, b) => b.requestTime - a.requestTime)
          .map((record) => ({ ...record })),
      );
    },
    deleteExpired(now) {
      let deleted = 0;
      for (const [requestId, record] of records) {
        if (record.expiresAt > now) continue;
        records.delete(requestId);
        deleted += 1;
      }
      return Promise.resolve(deleted);
    },
  };
}
