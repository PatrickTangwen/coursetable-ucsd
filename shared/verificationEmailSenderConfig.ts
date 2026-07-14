export function validateVerificationEmailSenderConfig(
  senderDomain: string,
  fromAddress: string,
) {
  if (!senderDomain.trim())
    throw new Error('Verification email sender domain is required');
  if (!fromAddress.trim())
    throw new Error('Verification email from address is required');

  if (!/^[^\s<>@]+@[^\s<>@]+$/u.test(fromAddress)) {
    throw new Error(
      'Verification email from address must be a bare email address',
    );
  }
  const addressDomain = fromAddress
    .slice(fromAddress.indexOf('@') + 1)
    .toLowerCase();
  if (addressDomain !== senderDomain.toLowerCase()) {
    throw new Error(
      'Verification email from address must use the configured sender domain',
    );
  }
}
