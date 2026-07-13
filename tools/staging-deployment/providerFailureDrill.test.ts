import { describe, expect, it } from 'vitest';

import {
  expectedProviderFailureError,
  providerFailureDrillSecrets,
  providerFailureEvidence,
} from './providerFailureDrill.js';

const environment = {
  UPSTASH_REDIS_REST_URL: 'https://redis.invalid',
  UPSTASH_REDIS_REST_TOKEN: 'real-redis-token',
  RESEND_API_KEY: 'real-resend-key',
  SESSION_SECRET: 'real-session-secret',
  TELEMETRY_HMAC_KEY: 'real-telemetry-key',
  VERIFICATION_EMAIL_FROM_ADDRESS: 'sender-value',
};

describe('hosted provider failure drill', () => {
  it.each([
    ['resend', 'RESEND_API_KEY'],
    ['upstash', 'UPSTASH_REDIS_REST_TOKEN'],
  ] as const)(
    'invalidates only the selected %s credential',
    (provider, key) => {
      const secrets = providerFailureDrillSecrets(provider, environment);

      expect(secrets[key]).toBe('invalid-hosted-failure-drill');
      for (const [name, value] of Object.entries(environment))
        if (name !== key) expect(secrets[name]).toBe(value);
    },
  );

  it.each([
    ['resend', 'VERIFICATION_DELIVERY_FAILED'],
    ['upstash', 'VERIFICATION_REQUEST_UNAVAILABLE'],
  ] as const)('defines the public %s failure response', (provider, error) => {
    expect(expectedProviderFailureError(provider)).toBe(error);
    expect(providerFailureEvidence(provider, 503, error, 200)).toEqual({
      result: 'passed',
      provider,
      accountPath: 'failed-closed',
      catalog: 'available',
    });
  });

  it('rejects false success and catalog collateral damage', () => {
    expect(() =>
      providerFailureEvidence('resend', 200, 'verification_sent', 200),
    ).toThrow('Hosted provider failure drill did not fail closed');
    expect(() =>
      providerFailureEvidence(
        'resend',
        503,
        'VERIFICATION_DELIVERY_FAILED',
        503,
      ),
    ).toThrow('Hosted provider failure drill affected the public Catalog');
  });
});
