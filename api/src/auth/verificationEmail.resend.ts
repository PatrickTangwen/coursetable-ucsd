import { Resend } from 'resend';

import type { VerificationEmailSender } from './verificationEmail.sender.js';

interface ResendEmailRequest {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface ResendEmailClient {
  send: (request: ResendEmailRequest) => Promise<{
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

function validateSenderConfig(senderDomain: string, fromAddress: string) {
  if (!senderDomain.trim())
    throw new Error('Verification email sender domain is required');
  if (!fromAddress.trim())
    throw new Error('Verification email from address is required');

  const addressDomain = fromAddress.split('@')[1]?.toLowerCase();
  if (addressDomain !== senderDomain.toLowerCase()) {
    throw new Error(
      'Verification email from address must use the configured sender domain',
    );
  }
}

export function createResendVerificationEmailSender({
  apiKey,
  senderDomain,
  fromAddress,
  client,
}: ResendVerificationEmailSenderOptions): VerificationEmailSender {
  if (!apiKey.trim()) throw new Error('Resend API key is required');
  validateSenderConfig(senderDomain, fromAddress);

  const emailClient =
    client ??
    (() => {
      const resend = new Resend(apiKey);
      return {
        send: (request: ResendEmailRequest) => resend.emails.send(request),
      };
    })();

  return {
    async sendVerificationEmail(message) {
      const response = await emailClient.send({
        from: `SunGrid <${fromAddress}>`,
        to: message.recipient,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (response.error) {
        throw new Error(
          `Resend rejected verification email: ${response.error.message}`,
        );
      }
      if (!response.data)
        throw new Error('Resend did not accept verification email');
    },
  };
}
