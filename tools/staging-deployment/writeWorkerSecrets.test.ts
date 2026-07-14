import { describe, expect, it } from 'vitest';

import { workerSecrets } from './writeWorkerSecrets.js';

const senderDomain = 'mail.example.invalid';

function runtimeEnvironment() {
  return {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'redis-token',
    RESEND_API_KEY: 'resend-key',
    SESSION_SECRET: 'session-secret',
    TELEMETRY_HMAC_KEY: 'telemetry-key',
    VERIFICATION_EMAIL_FROM_ADDRESS: `login@${senderDomain}`,
    VERIFICATION_EMAIL_SENDER_DOMAIN: senderDomain,
  };
}

function expectWorkerSecretsFailure(
  environment: ReturnType<typeof runtimeEnvironment>,
  message: string,
  sensitiveValue?: string,
) {
  let error: unknown = null;
  try {
    workerSecrets(environment);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  const rendered = String(error);
  expect(rendered).toContain(message);
  if (sensitiveValue) expect(rendered).not.toContain(sensitiveValue);
}

describe('hosted Worker secret bundle', () => {
  it('contains only runtime secrets and never migration or backup credentials', () => {
    const environment = runtimeEnvironment();
    const secrets = workerSecrets(environment);

    expect(Object.keys(secrets).sort()).toEqual(
      Object.keys(environment)
        .filter((name) => name !== 'VERIFICATION_EMAIL_SENDER_DOMAIN')
        .sort(),
    );
    expect(secrets).not.toHaveProperty('NEON_MIGRATION_DATABASE_URL');
    expect(secrets).not.toHaveProperty('NEON_DIRECT_DATABASE_URL');
    expect(secrets).not.toHaveProperty('R2_CATALOG_SECRET_ACCESS_KEY');
  });

  it('rejects a from address outside the configured sender domain without exposing it', () => {
    const fromAddress = 'login@other.example.invalid';
    const environment = {
      ...runtimeEnvironment(),
      VERIFICATION_EMAIL_FROM_ADDRESS: fromAddress,
    };

    expectWorkerSecretsFailure(
      environment,
      'Verification email from address must use the configured sender domain',
      fromAddress,
    );
  });

  it('rejects a blank runtime secret before writing the bundle', () => {
    const environment = {
      ...runtimeEnvironment(),
      SESSION_SECRET: '   ',
    };

    expectWorkerSecretsFailure(
      environment,
      'Missing Worker runtime input: SESSION_SECRET',
    );
  });

  it.each([
    [
      'VERIFICATION_EMAIL_FROM_ADDRESS',
      'Verification email from address is required',
    ],
    [
      'VERIFICATION_EMAIL_SENDER_DOMAIN',
      'Verification email sender domain is required',
    ],
  ] as const)(
    'rejects a blank %s before writing the bundle',
    (name, message) => {
      const environment = {
        ...runtimeEnvironment(),
        [name]: '   ',
      };

      expectWorkerSecretsFailure(environment, message);
    },
  );

  it.each([
    `SunGrid <login@${senderDomain}>`,
    ` login@${senderDomain}`,
    `login@${senderDomain}@other.example.invalid`,
  ])('rejects non-bare from address %s without exposing it', (fromAddress) => {
    const environment = {
      ...runtimeEnvironment(),
      VERIFICATION_EMAIL_FROM_ADDRESS: fromAddress,
    };

    expectWorkerSecretsFailure(
      environment,
      'Verification email from address must be a bare email address',
      fromAddress,
    );
  });
});
