import {
  emailDeliveryAuditRetentionMs,
  type EmailDeliveryAuditStore,
  type EmailDeliveryOutcome,
} from './emailDeliveryAudit.store.js';
import {
  VerificationEmailDeliveryError,
  type VerificationEmailSender,
} from './verificationEmail.sender.js';

class AuditOutcomeWriteError extends Error {}

export function createAuditedVerificationEmailSender(
  sender: VerificationEmailSender,
  audit: EmailDeliveryAuditStore,
): VerificationEmailSender {
  return {
    async sendVerificationEmail(message) {
      await audit.recordRequest({
        normalizedRecipientEmail: message.recipient,
        requestId: message.deliveryId,
        providerMessageId: null,
        requestTime: message.requestedAt,
        deliveryOutcome: 'requested',
        expiresAt: message.requestedAt + emailDeliveryAuditRetentionMs,
      });

      try {
        const receipt = await sender.sendVerificationEmail(message);
        await recordOutcomeOrThrowAmbiguous(
          audit,
          message.deliveryId,
          'sent',
          receipt?.providerMessageId ?? null,
        );
        return receipt;
      } catch (error) {
        if (
          error instanceof VerificationEmailDeliveryError &&
          error.cause instanceof AuditOutcomeWriteError
        )
          throw error;

        const outcome =
          error instanceof VerificationEmailDeliveryError
            ? error.outcome
            : 'ambiguous';
        await recordOutcomeOrThrowAmbiguous(
          audit,
          message.deliveryId,
          outcome,
          null,
        );
        throw error;
      }
    },
  };
}

async function recordOutcomeOrThrowAmbiguous(
  audit: EmailDeliveryAuditStore,
  requestId: string,
  outcome: Exclude<EmailDeliveryOutcome, 'requested'>,
  providerMessageId: string | null,
) {
  try {
    await audit.recordOutcome(requestId, outcome, providerMessageId);
  } catch (error) {
    throw new VerificationEmailDeliveryError(
      'Verification email delivery outcome is unknown',
      'ambiguous',
      {
        cause: new AuditOutcomeWriteError('Email Delivery Audit unavailable', {
          cause: error,
        }),
      },
    );
  }
}
