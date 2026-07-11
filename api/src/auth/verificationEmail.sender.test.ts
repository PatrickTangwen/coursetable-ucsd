import { describe, expect, it, vi } from 'vitest';

import {
  createDevelopmentVerificationEmailSender,
  createVerificationEmailDelivery,
  createVerificationEmailMessage,
} from './verificationEmail.sender.js';

const message = {
  recipient: 'student@ucsd.edu',
  subject: 'Verification subject',
  text: 'Verification text',
  html: '<p>Verification HTML</p>',
};

describe('verification email delivery configuration', () => {
  it('provides an explicit development sender and dev-code seam', async () => {
    const delivery = createVerificationEmailDelivery({
      nodeEnv: 'development',
    });

    expect(delivery.exposeVerificationCode).toBe(true);
    await expect(
      delivery.sender.sendVerificationEmail(message),
    ).resolves.toBeUndefined();
  });

  it('fails closed when hosted sender configuration is missing', () => {
    expect(() =>
      createVerificationEmailDelivery({ nodeEnv: 'production' }),
    ).toThrow('Verification email sender config is required in hosted mode');
  });

  it('uses the configured hosted sender without exposing dev codes', () => {
    const sendVerificationEmail = vi.fn(() => Promise.resolve());
    const sender = { sendVerificationEmail };
    const delivery = createVerificationEmailDelivery({
      nodeEnv: 'production',
      hostedSender: sender,
    });

    expect(delivery.sender).toBe(sender);
    expect(delivery.exposeVerificationCode).toBe(false);
  });

  it('keeps the development sender available as an explicit test seam', () => {
    expect(
      typeof createDevelopmentVerificationEmailSender().sendVerificationEmail,
    ).toBe('function');
  });

  it('builds provider-neutral copy from the authoritative lifetime', () => {
    const verificationMessage = createVerificationEmailMessage({
      email: 'student@ucsd.edu',
      code: '123456',
      createdAt: 1_000_000,
      expiresAt: 1_120_000,
    });

    expect(verificationMessage).toEqual({
      recipient: 'student@ucsd.edu',
      subject: 'Your SunGrid verification code',
      text: 'Your SunGrid verification code is 123456. This code expires in 2 minutes. If you did not request this code, you can ignore this email.',
      html: '<p>Your SunGrid verification code is:</p><p><strong>123456</strong></p><p>This code expires in 2 minutes. If you did not request this code, you can ignore this email.</p>',
    });
    expect(JSON.stringify(verificationMessage)).not.toMatch(/https?:\/\//u);
  });
});
