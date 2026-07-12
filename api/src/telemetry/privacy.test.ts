import { describe, expect, it } from 'vitest';

import {
  assertGeneralTelemetrySafe,
  createRecipientTelemetryReference,
  scrubGeneralTelemetry,
} from './privacy.js';

const sensitivePayload = {
  message:
    'Delivery to student@ucsd.edu used code 123456 and postgresql://user:password@db.invalid/app',
  request: {
    data: { email: 'student@ucsd.edu', code: '123456' },
    headers: {
      authorization: 'Bearer provider-credential',
      cookie: 'sungrid_session=session-id-value',
    },
  },
  extra: {
    codeHash: 'a'.repeat(64),
    connectionString: 'postgresql://user:password@db.invalid/app',
    requestBody: { email: 'student@ucsd.edu' },
    sessionId: 'session-id-value',
  },
};

describe('general telemetry privacy', () => {
  it('scrubs complete emails and authentication material recursively', () => {
    const scrubbed = scrubGeneralTelemetry(sensitivePayload);
    const rendered = JSON.stringify(scrubbed);

    expect(rendered).not.toContain('student@ucsd.edu');
    expect(rendered).not.toContain('123456');
    expect(rendered).not.toContain('a'.repeat(64));
    expect(rendered).not.toContain('sungrid_session');
    expect(rendered).not.toContain('session-id-value');
    expect(rendered).not.toContain('provider-credential');
    expect(rendered).not.toContain('postgresql://');
    expect(rendered).not.toContain('requestBody');
    expect(() => assertGeneralTelemetrySafe(scrubbed)).not.toThrow();
  });

  it.each([
    { email: 'student@ucsd.edu' },
    { verificationCode: '123456' },
    { codeHash: 'a'.repeat(64) },
    { Cookie: 'sungrid_session=session-id-value' },
    { sessionId: 'session-id-value' },
    { requestBody: { query: 'secret' } },
    { databaseUrl: 'postgresql://user:password@db.invalid/app' },
    { apiKey: 'provider-credential' },
    {
      message: 'Delivery failed with session-id-value and provider-credential',
    },
  ])('rejects unsafe telemetry or evidence: %j', (unsafe) => {
    expect(() => assertGeneralTelemetrySafe(unsafe)).toThrow(
      'Unsafe general telemetry payload',
    );
  });

  it('uses masked email and an environment-specific HMAC for correlation', () => {
    const staging = createRecipientTelemetryReference(
      'Student@UCSD.edu',
      'staging-hmac-key',
    );
    const production = createRecipientTelemetryReference(
      'student@ucsd.edu',
      'production-hmac-key',
    );

    expect(staging.maskedEmail).toBe('s***@ucsd.edu');
    expect(staging.recipientRef).toMatch(/^recipient_[a-f\d]{16}$/u);
    expect(production.recipientRef).not.toBe(staging.recipientRef);
    expect(JSON.stringify(staging)).not.toContain('student@ucsd.edu');
    expect(() => assertGeneralTelemetrySafe(staging)).not.toThrow();
  });
});
