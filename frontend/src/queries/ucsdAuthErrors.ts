export function requestVerificationErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'NON_UCSD_EMAIL':
      return 'Use a UCSD email address ending in @ucsd.edu.';
    case 'VERIFICATION_COOLDOWN':
      return 'A code was just sent. Wait a moment before requesting another.';
    case 'VERIFICATION_DELIVERY_FAILED':
      return 'We could not send the verification email. Try again shortly.';
    default:
      return null;
  }
}

export function completeVerificationErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'NON_UCSD_EMAIL':
      return 'Use a UCSD email address ending in @ucsd.edu.';
    case 'INVALID_VERIFICATION_CODE':
      return 'That verification code is incorrect.';
    case 'VERIFICATION_CODE_EXPIRED':
      return 'That code has expired or was already used. Request a new code.';
    default:
      return null;
  }
}
