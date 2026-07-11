function retryDuration(seconds: number | undefined) {
  if (!seconds || seconds < 1) return 'a moment';
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function requestVerificationErrorMessage(
  errorCode: string,
  retryAfterSeconds?: number,
) {
  const wait = retryDuration(retryAfterSeconds);
  switch (errorCode) {
    case 'NON_UCSD_EMAIL':
      return 'Use a UCSD email address ending in @ucsd.edu.';
    case 'VERIFICATION_COOLDOWN':
      return `A code was just sent. Request another in ${wait}.`;
    case 'VERIFICATION_REQUEST_PENDING':
      return `A verification request is still processing. Try again in ${wait}.`;
    case 'VERIFICATION_RATE_LIMIT':
      return `Too many verification requests. Try again in ${wait}.`;
    case 'VERIFICATION_DELIVERY_FAILED':
      return 'We could not send the verification email. Try again shortly.';
    case 'VERIFICATION_DELIVERY_UNCERTAIN':
      return 'Email delivery is still being confirmed. Use the first code if it arrives; do not request another yet.';
    case 'VERIFICATION_REQUEST_UNAVAILABLE':
      return 'Verification requests are temporarily unavailable. Try again shortly.';
    default:
      return null;
  }
}

export function completeVerificationErrorMessage(
  errorCode: string,
  retryAfterSeconds?: number,
) {
  switch (errorCode) {
    case 'NON_UCSD_EMAIL':
      return 'Use a UCSD email address ending in @ucsd.edu.';
    case 'INVALID_VERIFICATION_CODE':
      return 'That verification code is incorrect.';
    case 'VERIFICATION_CODE_EXPIRED':
      return 'That code has expired or was already used. Request a new code.';
    case 'VERIFICATION_ATTEMPT_LIMIT':
      return `Too many verification attempts. Try again in ${retryDuration(retryAfterSeconds)}.`;
    default:
      return null;
  }
}
