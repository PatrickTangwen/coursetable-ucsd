import { describe, expect, it } from 'vitest';

import { scrubBrowserTelemetry } from './sentryPrivacy';

describe('browser telemetry privacy', () => {
  it('removes identity and request material before Sentry receives it', () => {
    const payload = {
      message:
        'Verification for student@ucsd.edu used 123456 and postgresql://user:password@db.invalid/app',
      user: { id: 'app-user-1', email: 'student@ucsd.edu' },
      request: {
        body: { email: 'student@ucsd.edu', code: '123456' },
        headers: { authorization: 'Bearer provider-token' },
      },
      breadcrumbs: [{ message: 'Cookie: sungrid_session=session-id-value' }],
      extra: { codeHash: 'a'.repeat(64) },
    };

    const scrubbed = scrubBrowserTelemetry(payload);
    const rendered = JSON.stringify(scrubbed);

    expect(scrubbed.user).toEqual({ id: 'app-user-1' });
    expect(scrubbed.request).toEqual({});
    expect(rendered).not.toContain('student@ucsd.edu');
    expect(rendered).not.toContain('123456');
    expect(rendered).not.toContain('provider-token');
    expect(rendered).not.toContain('sungrid_session');
    expect(rendered).not.toContain('postgresql://');
    expect(rendered).not.toContain('a'.repeat(64));
  });

  it('handles cyclic hints without leaking their contents', () => {
    const payload: { message: string; hint?: unknown } = { message: 'safe' };
    payload.hint = payload;

    expect(scrubBrowserTelemetry(payload)).toEqual({
      message: 'safe',
      hint: '[REDACTED_CYCLE]',
    });
  });
});
