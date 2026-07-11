import { describe, expect, it } from 'vitest';

import {
  completeVerificationErrorMessage,
  requestVerificationErrorMessage,
} from './ucsdAuthErrors';

describe('UCSD auth user-facing error mapping', () => {
  it('distinguishes cooldown and delivery failures', () => {
    expect(requestVerificationErrorMessage('VERIFICATION_COOLDOWN')).toContain(
      'just sent',
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
  });
});
