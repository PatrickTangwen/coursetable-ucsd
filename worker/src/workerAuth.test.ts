import { describe, expect, it } from 'vitest';

import { createWorkerAuthHandler } from './workerAuth.js';
import { createMemoryUcsdAuthStore } from '../../api/src/auth/ucsdAuth.memory.js';
import { VerificationEmailDeliveryError } from '../../api/src/auth/verificationEmail.sender.js';

const post = (
  handler: (request: Request) => Promise<Response>,
  body: unknown,
) =>
  handler(
    new Request(
      'https://staging.sungridplanner.com/api/auth/ucsd/request-verification',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),
  );

function createOptions() {
  return {
    store: createMemoryUcsdAuthStore(),
    emailSender: { sendVerificationEmail: () => Promise.resolve() },
    codeGenerator: () => '123456',
    exposeVerificationCode: false,
    now: () => 1_000_000,
    requestCooldownMs: 1,
    session: {
      destroy: () => Promise.resolve(),
      establish: () => Promise.resolve(),
      getUser: () => Promise.resolve(null),
    },
  };
}

describe('Worker auth failure contract', () => {
  it('rejects non-UCSD email without sending or exposing a code', async () => {
    const response = await post(createWorkerAuthHandler(createOptions()), {
      email: 'student@example.com',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'NON_UCSD_EMAIL',
      message: 'Use a UCSD email address ending in @ucsd.edu.',
    });
  });

  it('preserves rate-limit semantics and retry evidence', async () => {
    const options = createOptions();
    const handler = createWorkerAuthHandler({
      ...options,
      requestLimiter: {
        admitSource: () =>
          Promise.resolve({ allowed: false as const, retryAfterMs: 5_500 }),
        consumeSend: () => Promise.resolve({ allowed: true as const }),
      },
    });
    const response = await post(handler, { email: 'student@ucsd.edu' });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('6');
    expect(await response.json()).toMatchObject({
      error: 'VERIFICATION_RATE_LIMIT',
      retryAfterSeconds: 6,
    });
  });

  it('reports provider rejection without false success or a dev code', async () => {
    const options = createOptions();
    const response = await post(
      createWorkerAuthHandler({
        ...options,
        emailSender: {
          sendVerificationEmail: () =>
            Promise.reject(
              new VerificationEmailDeliveryError(
                'provider rejected',
                'definitive_failure',
              ),
            ),
        },
      }),
      { email: 'student@ucsd.edu' },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'VERIFICATION_DELIVERY_FAILED',
      message: 'Verification email could not be sent. Try again shortly.',
    });
  });

  it('bounds unexpected dependency failures behind a generic response', async () => {
    const options = createOptions();
    const response = await post(
      createWorkerAuthHandler({
        ...options,
        store: {
          ...options.store,
          reserveVerification: () => Promise.reject(new Error('db secret')),
        },
      }),
      { email: 'student@ucsd.edu' },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'AUTH_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable.',
    });
  });
});
