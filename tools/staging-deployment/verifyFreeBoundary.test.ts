import { describe, expect, it } from 'vitest';

import { verifyFreeBoundary } from './verifyFreeBoundary.js';

const config = {
  accountId: 'account-id',
  apiToken: 'redacted-token',
  bucket: 'sungrid-staging-catalog',
  hostname: 'staging.sungridplanner.com',
  hyperdriveId: '1234567890abcdef1234567890abcdef',
  worker: 'sungrid-staging',
};

function response(result: unknown) {
  return Promise.resolve(Response.json({ success: true, result }));
}

function freeFetcher(input: string | URL | Request) {
  const { pathname } = new URL(
    typeof input === 'string' || input instanceof URL ? input : input.url,
  );
  if (pathname.endsWith('/workers/account-settings'))
    return response({ default_usage_model: 'bundled' });
  if (pathname.endsWith('/workers/scripts/sungrid-staging/subdomain'))
    return response({ enabled: false, previews_enabled: false });
  if (pathname.endsWith('/workers/scripts'))
    return response([{ id: 'sungrid-staging' }]);
  if (pathname.endsWith('/workers/scripts/sungrid-staging/schedules'))
    return response([{ cron: '0 8 * * *' }]);
  if (pathname.endsWith('/workers/domains')) {
    return response([
      {
        hostname: 'staging.sungridplanner.com',
        service: 'sungrid-staging',
      },
    ]);
  }
  if (pathname.endsWith('/r2/buckets/sungrid-staging-catalog')) {
    return response({
      name: 'sungrid-staging-catalog',
      storage_class: 'Standard',
    });
  }
  if (pathname.endsWith('/domains/managed'))
    return response({ enabled: false });
  if (pathname.endsWith('/domains/custom')) return response({ domains: [] });
  if (pathname.includes('/hyperdrive/configs/')) {
    return response({
      id: config.hyperdriveId,
      caching: { disabled: true },
      origin_connection_limit: 20,
    });
  }
  throw new Error(`Unexpected Cloudflare API path: ${pathname}`);
}

describe('Cloudflare Workers Free boundary', () => {
  it('proves the non-Standard usage model and accepted provider settings', async () => {
    const evidence = await verifyFreeBoundary(config, freeFetcher);

    expect(evidence).toMatchObject({
      result: 'passed',
      plan: 'Workers Free',
      workerUsageModel: 'bundled',
      workersDevEnabled: false,
      previewUrlsEnabled: false,
      accountCronTriggers: 1,
      r2StorageClass: 'Standard',
      r2DevEnabled: false,
      r2CustomDomains: 0,
      hyperdriveCachingDisabled: true,
      hyperdriveOriginConnectionLimit: 20,
    });
  });

  it('blocks the Workers Paid Standard usage model', async () => {
    const paidFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/workers/account-settings'))
        return response({ default_usage_model: 'standard' });
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, paidFetcher)).rejects.toThrow(
      'Workers Paid Standard usage model is enabled',
    );
  });
});
