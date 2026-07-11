import { Resend } from 'resend';

import type {
  VerificationEmail,
  VerificationEmailSender,
} from './verificationEmail.sender.js';

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

function verificationEmailContent({ code }: VerificationEmail) {
  return {
    subject: 'Your SunGrid verification code',
    text: `Your SunGrid verification code is ${code}. It expires in 15 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Your SunGrid verification code is:</p><p><strong>${code}</strong></p><p>This code expires in 15 minutes. If you did not request this code, you can ignore this email.</p>`,
  };
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
    async sendVerificationEmail(verification) {
      const response = await emailClient.send({
        from: `SunGrid <${fromAddress}>`,
        to: verification.email,
        ...verificationEmailContent(verification),
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
