import { describe, expect, it, vi } from 'vitest';

import {
  createDevelopmentVerificationEmailSender,
  createVerificationEmailDelivery,
} from './verificationEmail.sender.js';

describe('verification email delivery configuration', () => {
  it('provides an explicit development sender and dev-code seam', async () => {
    const delivery = createVerificationEmailDelivery({
      nodeEnv: 'development',
    });

    expect(delivery.exposeVerificationCode).toBe(true);
    await expect(
      delivery.sender.sendVerificationEmail({
        email: 'student@ucsd.edu',
        code: '123456',
        expiresAt: 1_900_000,
      }),
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
});
