import { describe, expect, it } from 'vitest';

import {
  completeVerificationErrorMessage,
  requestVerificationErrorMessage,
} from './ucsdAuthErrors';

describe('UCSD auth user-facing error mapping', () => {
  it('distinguishes cooldown and delivery failures', () => {
    expect(requestVerificationErrorMessage('VERIFICATION_COOLDOWN', 42)).toBe(
      'A code was just sent. Request another in 42 seconds.',
    );
    expect(requestVerificationErrorMessage('VERIFICATION_RATE_LIMIT', 61)).toBe(
      'Too many verification requests. Try again in 2 minutes.',
    );
    expect(
      requestVerificationErrorMessage('VERIFICATION_DELIVERY_FAILED'),
    ).toContain('could not send');
  });

  it('distinguishes incorrect and expired or consumed codes', () => {
    expect(
      completeVerificationErrorMessage('INVALID_VERIFICATION_CODE'),
    ).toContain('incorrect');
    expect(
      completeVerificationErrorMessage('VERIFICATION_CODE_EXPIRED'),
    ).toContain('expired');
    expect(
      completeVerificationErrorMessage('VERIFICATION_ATTEMPT_LIMIT', 90),
    ).toBe('Too many verification attempts. Try again in 2 minutes.');
  });
});
