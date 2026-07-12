import { describe, expect, it } from 'vitest';

import { createMemoryEmailDeliveryAuditStore } from './emailDeliveryAudit.memory.js';
import { createAuditedVerificationEmailSender } from './emailDeliveryAudit.sender.js';
import { emailDeliveryAuditRetentionMs } from './emailDeliveryAudit.store.js';
import {
  VerificationEmailDeliveryError,
  type VerificationEmailMessage,
  type VerificationEmailSender,
} from './verificationEmail.sender.js';

const requestedAt = Date.parse('2026-07-11T12:00:00.000Z');
const message: VerificationEmailMessage = {
  deliveryId: 'verification/1/2',
  recipient: 'student@ucsd.edu',
  requestedAt,
  subject: 'Verification subject',
  text: 'Verification text',
  html: '<p>Verification HTML</p>',
};

describe('audited verification email sender', () => {
  it('records the provider message ID and sent outcome', async () => {
    const audit = createMemoryEmailDeliveryAuditStore();
    const sender = createAuditedVerificationEmailSender(
      {
        sendVerificationEmail: () =>
          Promise.resolve({ providerMessageId: 'email_123' }),
      },
      audit,
    );

    await expect(sender.sendVerificationEmail(message)).resolves.toEqual({
      providerMessageId: 'email_123',
    });
    await expect(
      audit.findRecentByRecipient('student@ucsd.edu', requestedAt + 1),
    ).resolves.toEqual([
      {
        normalizedRecipientEmail: 'student@ucsd.edu',
        requestId: 'verification/1/2',
        providerMessageId: 'email_123',
        requestTime: requestedAt,
        deliveryOutcome: 'sent',
        expiresAt: requestedAt + emailDeliveryAuditRetentionMs,
      },
    ]);
  });

  it.each([
    ['definitive_failure', 'definitive_failure'],
    ['ambiguous', 'ambiguous'],
  ] as const)(
    'records a %s provider outcome',
    async (errorOutcome, auditOutcome) => {
      const audit = createMemoryEmailDeliveryAuditStore();
      const providerError = new VerificationEmailDeliveryError(
        'provider did not accept delivery',
        errorOutcome,
      );
      const sender = createAuditedVerificationEmailSender(
        {
          sendVerificationEmail: () => Promise.reject(providerError),
        },
        audit,
      );

      await expect(sender.sendVerificationEmail(message)).rejects.toBe(
        providerError,
      );
      const [record] = await audit.findRecentByRecipient(
        'student@ucsd.edu',
        requestedAt + 1,
      );
      expect(record).toMatchObject({
        deliveryOutcome: auditOutcome,
        providerMessageId: null,
      });
    },
  );

  it('does not call the provider when the initial audit write fails', async () => {
    let providerCalled = false;
    const provider: VerificationEmailSender = {
      sendVerificationEmail() {
        providerCalled = true;
        return Promise.resolve({ providerMessageId: 'email_123' });
      },
    };
    const sender = createAuditedVerificationEmailSender(provider, {
      recordRequest: () => Promise.reject(new Error('audit unavailable')),
      recordOutcome: () => Promise.resolve(),
      findRecentByRecipient: () => Promise.resolve([]),
      deleteExpired: () => Promise.resolve(0),
    });

    await expect(sender.sendVerificationEmail(message)).rejects.toThrow(
      'audit unavailable',
    );
    expect(providerCalled).toBe(false);
  });
});
