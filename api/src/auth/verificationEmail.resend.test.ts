import { describe, expect, it } from 'vitest';

import { createResendVerificationEmailSender } from './verificationEmail.resend.js';

const config = {
  apiKey: 're_test_key',
  senderDomain: 'mail.sungridplanner.com',
  fromAddress: 'login@mail.sungridplanner.com',
};

describe('Resend verification email sender', () => {
  it('awaits provider acceptance with verification-code-only content', async () => {
    const requests: unknown[] = [];
    const sender = createResendVerificationEmailSender({
      ...config,
      client: {
        send(request) {
          requests.push(request);
          return Promise.resolve({ data: { id: 'email_123' }, error: null });
        },
      },
    });

    await sender.sendVerificationEmail({
      email: 'student@ucsd.edu',
      code: '123456',
      expiresAt: 1_900_000,
    });

    expect(requests).toEqual([
      {
        from: 'SunGrid <login@mail.sungridplanner.com>',
        to: 'student@ucsd.edu',
        subject: 'Your SunGrid verification code',
        text: 'Your SunGrid verification code is 123456. It expires in 15 minutes. If you did not request this code, you can ignore this email.',
        html: '<p>Your SunGrid verification code is:</p><p><strong>123456</strong></p><p>This code expires in 15 minutes. If you did not request this code, you can ignore this email.</p>',
      },
    ]);
    expect(JSON.stringify(requests)).not.toMatch(/https?:\/\//u);
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

    await expect(
      sender.sendVerificationEmail({
        email: 'student@ucsd.edu',
        code: '123456',
        expiresAt: 1_900_000,
      }),
    ).rejects.toThrow(
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

    await expect(
      sender.sendVerificationEmail({
        email: 'student@ucsd.edu',
        code: '123456',
        expiresAt: 1_900_000,
      }),
    ).rejects.toThrow('network unavailable');
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
