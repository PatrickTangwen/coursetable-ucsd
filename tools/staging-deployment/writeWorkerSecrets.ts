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
  return Object.fromEntries(
    runtimeSecretNames.map((name) => {
      const value = environment[name];
      if (!value) throw new Error(`Missing Worker runtime input: ${name}`);
      return [name, value];
    }),
  );
}
