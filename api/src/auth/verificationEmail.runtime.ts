import type { VerificationEmailSender } from './verificationEmail.sender.js';

let validationSender: VerificationEmailSender | null = null;

export function installHostedValidationSender(sender: VerificationEmailSender) {
  if (validationSender)
    throw new Error('Hosted validation sender is already installed');
  validationSender = sender;
}

export function resolveVerificationEmailSender(
  productionSender: VerificationEmailSender,
) {
  return validationSender ?? productionSender;
}
