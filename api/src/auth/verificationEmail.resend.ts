import { Resend } from 'resend';

import {
  VerificationEmailDeliveryError,
  type VerificationEmailSender,
} from './verificationEmail.sender.js';
import { validateVerificationEmailSenderConfig } from '../../../shared/verificationEmailSenderConfig.js';

interface ResendEmailRequest {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface ResendSendOptions {
  idempotencyKey: string;
}

interface ResendEmailClient {
  send: (
    request: ResendEmailRequest,
    options: ResendSendOptions,
  ) => Promise<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>;
}

interface ResendVerificationEmailSenderOptions {
  apiKey: string;
  senderDomain: string;
  fromAddress: string;
  client?: ResendEmailClient;
}

export function createResendVerificationEmailSender({
  apiKey,
  senderDomain,
  fromAddress,
  client,
}: ResendVerificationEmailSenderOptions): VerificationEmailSender {
  if (!apiKey.trim()) throw new Error('Resend API key is required');
  validateVerificationEmailSenderConfig(senderDomain, fromAddress);

  const emailClient =
    client ??
    (() => {
      const resend = new Resend(apiKey);
      return {
        send: (request: ResendEmailRequest, options: ResendSendOptions) =>
          resend.emails.send(request, options),
      };
    })();

  return {
    async sendVerificationEmail(message) {
      const response = await emailClient
        .send(
          {
            from: `SunGrid <${fromAddress}>`,
            to: message.recipient,
            subject: message.subject,
            text: message.text,
            html: message.html,
          },
          { idempotencyKey: message.deliveryId },
        )
        .catch((error: unknown) => {
          throw new VerificationEmailDeliveryError(
            'Verification email delivery outcome is unknown',
            'ambiguous',
            { cause: error },
          );
        });

      if (response.error) {
        throw new VerificationEmailDeliveryError(
          'Resend rejected verification email',
          'definitive_failure',
          { cause: response.error },
        );
      }
      if (!response.data) {
        throw new VerificationEmailDeliveryError(
          'Verification email delivery outcome is unknown',
          'ambiguous',
        );
      }
      return { providerMessageId: response.data.id };
    },
  };
}
