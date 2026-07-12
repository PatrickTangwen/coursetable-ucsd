import { describe, expect, it } from 'vitest';

import { createMemoryEmailDeliveryAuditStore } from './emailDeliveryAudit.memory.js';
import {
  emailDeliveryAuditRetentionMs,
  emailDeliveryAuditRecordFields,
} from './emailDeliveryAudit.store.js';

describe('Email Delivery Audit store', () => {
  it('stores exactly the six allowed fields and finds recent recipient outcomes', async () => {
    const store = createMemoryEmailDeliveryAuditStore();
    const requestTime = Date.parse('2026-07-11T12:00:00.000Z');

    await store.recordRequest({
      normalizedRecipientEmail: 'student@ucsd.edu',
      requestId: 'verification/1/2',
      providerMessageId: null,
      requestTime,
      deliveryOutcome: 'requested',
      expiresAt: requestTime + emailDeliveryAuditRetentionMs,
    });
    await store.recordOutcome('verification/1/2', 'sent', 'email_123');

    const records = await store.findRecentByRecipient(
      'student@ucsd.edu',
      requestTime + 1,
    );
    expect(records).toHaveLength(1);
    expect(Object.keys(records[0]!).sort()).toEqual(
      [...emailDeliveryAuditRecordFields].sort(),
    );
    expect(records[0]).toEqual({
      normalizedRecipientEmail: 'student@ucsd.edu',
      requestId: 'verification/1/2',
      providerMessageId: 'email_123',
      requestTime,
      deliveryOutcome: 'sent',
      expiresAt: requestTime + emailDeliveryAuditRetentionMs,
    });
    expect(JSON.stringify(records[0])).not.toMatch(
      /code|cookie|session|body|credential|connection/iu,
    );
  });

  it('expires rows after seven days through idempotent cleanup', async () => {
    const store = createMemoryEmailDeliveryAuditStore();
    const requestTime = Date.parse('2026-07-01T00:00:00.000Z');
    const expiresAt = requestTime + emailDeliveryAuditRetentionMs;

    await store.recordRequest({
      normalizedRecipientEmail: 'student@ucsd.edu',
      requestId: 'verification/expired',
      providerMessageId: null,
      requestTime,
      deliveryOutcome: 'requested',
      expiresAt,
    });

    expect(await store.deleteExpired(expiresAt - 1)).toBe(0);
    expect(await store.deleteExpired(expiresAt)).toBe(1);
    expect(await store.deleteExpired(expiresAt)).toBe(0);
    expect(
      await store.findRecentByRecipient('student@ucsd.edu', expiresAt),
    ).toEqual([]);
  });

  it('enforces the runtime allowlist and exact seven-day retention', async () => {
    const store = createMemoryEmailDeliveryAuditStore();
    const requestTime = Date.parse('2026-07-11T00:00:00.000Z');
    const record = {
      normalizedRecipientEmail: 'student@ucsd.edu',
      requestId: 'verification/runtime-allowlist',
      providerMessageId: null,
      requestTime,
      deliveryOutcome: 'requested' as const,
      expiresAt: requestTime + emailDeliveryAuditRetentionMs,
      code: '123456',
    };

    await store.recordRequest(record);
    const [stored] = await store.findRecentByRecipient(
      'student@ucsd.edu',
      requestTime + 1,
    );
    expect(Object.keys(stored!).sort()).toEqual(
      [...emailDeliveryAuditRecordFields].sort(),
    );
    expect(JSON.stringify(stored)).not.toContain('123456');

    await expect(
      store.recordRequest({
        ...record,
        requestId: 'verification/invalid-expiry',
        expiresAt: requestTime + emailDeliveryAuditRetentionMs + 1,
      }),
    ).rejects.toThrow('must expire after seven days');
  });
});
