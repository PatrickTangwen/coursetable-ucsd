import { validateVerificationEmailSenderConfig } from '../../shared/verificationEmailSenderConfig.js';

const runtimeSecretNames = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'SESSION_SECRET',
  'TELEMETRY_HMAC_KEY',
  'VERIFICATION_EMAIL_FROM_ADDRESS',
] as const;

export function workerSecrets(environment: {
  [key: string]: string | undefined;
}) {
  validateVerificationEmailSenderConfig(
    environment.VERIFICATION_EMAIL_SENDER_DOMAIN ?? '',
    environment.VERIFICATION_EMAIL_FROM_ADDRESS ?? '',
  );
  const secrets = Object.fromEntries(
    runtimeSecretNames.map((name) => [
      name,
      requiredRuntimeInput(environment, name),
    ]),
  );
  return secrets;
}

function requiredRuntimeInput(
  environment: { [key: string]: string | undefined },
  name: string,
) {
  const value = environment[name];
  if (!value?.trim()) throw new Error(`Missing Worker runtime input: ${name}`);
  return value;
}
