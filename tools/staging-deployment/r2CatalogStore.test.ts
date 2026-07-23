import { describe, expect, it } from 'vitest';

import {
  withR2RequestRetries,
  withR2RequestTimeout,
} from './r2CatalogStore.js';

describe('R2 request timeout', () => {
  it('times out the complete operation when the provider ignores the abort signal', async () => {
    await expect(
      withR2RequestTimeout(
        'GET published snapshot body',
        () =>
          new Promise<never>(() => {
            // Simulates a provider operation that ignores the abort signal.
          }),
        10,
      ),
    ).rejects.toThrow('R2 GET published snapshot body timed out');
  }, 100);

  it('aborts a provider request that never settles', async () => {
    const request = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });

    await expect(
      withR2RequestTimeout('GET metadata.json', request, 10),
    ).rejects.toThrow('R2 GET metadata.json timed out');
  });

  it('preserves non-timeout provider failures', async () => {
    const failure = new Error('provider rejected request');

    await expect(
      withR2RequestTimeout('PUT metadata.json', () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });

  it('retries a complete operation after a bounded timeout', async () => {
    let attempts = 0;

    const result = await withR2RequestRetries(
      'GET published snapshot body',
      (signal) => {
        attempts += 1;
        if (attempts === 2) return Promise.resolve('available');
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        });
      },
      {
        attemptTimeoutMs: 10,
        maxAttempts: 2,
        retryDelayMs: 0,
      },
    );

    expect(result).toBe('available');
    expect(attempts).toBe(2);
  });

  it('does not retry a non-timeout provider failure', async () => {
    const failure = new Error('provider rejected request');
    let attempts = 0;

    await expect(
      withR2RequestRetries(
        'GET metadata.json',
        () => {
          attempts += 1;
          return Promise.reject(failure);
        },
        {
          attemptTimeoutMs: 10,
          maxAttempts: 3,
          retryDelayMs: 0,
        },
      ),
    ).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  it('stops retrying after the configured timeout attempt limit', async () => {
    let attempts = 0;

    await expect(
      withR2RequestRetries(
        'GET metadata.json',
        () => {
          attempts += 1;
          return new Promise<never>(() => {
            // Simulates a provider operation that never settles.
          });
        },
        {
          attemptTimeoutMs: 10,
          maxAttempts: 2,
          retryDelayMs: 0,
        },
      ),
    ).rejects.toThrow('R2 GET metadata.json timed out');
    expect(attempts).toBe(2);
  });
});
