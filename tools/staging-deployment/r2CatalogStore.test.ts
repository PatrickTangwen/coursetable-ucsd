import { describe, expect, it } from 'vitest';

import { withR2RequestTimeout } from './r2CatalogStore.js';

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
});
