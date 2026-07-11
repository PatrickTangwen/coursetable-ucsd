import { describe, expect, it } from 'vitest';

import { createResendVerificationEmailSender } from './verificationEmail.resend.js';

const config = {
  apiKey: 're_test_key',
  senderDomain: 'mail.sungridplanner.com',
  fromAddress: 'login@mail.sungridplanner.com',
};

const message = {
  deliveryId: 'verification/42',
  recipient: 'student@ucsd.edu',
  subject: 'Verification subject',
  text: 'Verification text',
  html: '<p>Verification HTML</p>',
};

describe('Resend verification email sender', () => {
  it('awaits provider acceptance and transports the supplied message', async () => {
    const requests: unknown[] = [];
    const sender = createResendVerificationEmailSender({
      ...config,
      client: {
        send(request, options) {
          requests.push({ request, options });
          return Promise.resolve({ data: { id: 'email_123' }, error: null });
        },
      },
    });

    await sender.sendVerificationEmail(message);

    expect(requests).toEqual([
      {
        request: {
          from: 'SunGrid <login@mail.sungridplanner.com>',
          to: 'student@ucsd.edu',
          subject: 'Verification subject',
          text: 'Verification text',
          html: '<p>Verification HTML</p>',
        },
        options: { idempotencyKey: 'verification/42' },
      },
    ]);
  });

  it('propagates a provider rejection instead of reporting success', async () => {
    const sender = createResendVerificationEmailSender({
      ...config,
      client: {
        send: () =>
          Promise.resolve({
            data: null,
            error: { message: 'sender domain is not verified' },
          }),
      },
    });

    await expect(sender.sendVerificationEmail(message)).rejects.toThrow(
      'Resend rejected verification email: sender domain is not verified',
    );
  });

  it('propagates transport failures', async () => {
    const sender = createResendVerificationEmailSender({
      ...config,
      client: {
        send: () => Promise.reject(new Error('network unavailable')),
      },
    });

    await expect(sender.sendVerificationEmail(message)).rejects.toThrow(
      'network unavailable',
    );
  });

  it('fails closed for missing or inconsistent sender configuration', () => {
    expect(() =>
      createResendVerificationEmailSender({ ...config, apiKey: '' }),
    ).toThrow('Resend API key is required');
    expect(() =>
      createResendVerificationEmailSender({
        ...config,
        fromAddress: 'login@example.com',
      }),
    ).toThrow(
      'Verification email from address must use the configured sender domain',
    );
  });
});
