import { describe, expect, it } from 'vitest';

import { verifyFreeBoundary } from './verifyFreeBoundary.js';

const config = {
  accountId: 'account-id',
  apiToken: 'redacted-token',
  bucket: 'sungrid-staging-catalog',
  hostname: 'staging.sungridplanner.com',
  hyperdriveId: '1234567890abcdef1234567890abcdef',
  publishedObjectReadbacks: 29,
  worker: 'sungrid-staging',
};

function response(result: unknown) {
  return Promise.resolve(Response.json({ success: true, result }));
}

function freeFetcher(input: string | URL | Request) {
  const { pathname } = new URL(
    typeof input === 'string' || input instanceof URL ? input : input.url,
  );
  if (pathname.endsWith('/graphql')) {
    return Promise.resolve(
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                workersInvocationsAdaptive: [
                  { sum: { requests: 25 }, quantiles: { cpuTimeP99: 5 } },
                ],
                r2OperationsAdaptiveGroups: [
                  {
                    sum: { requests: 40 },
                    dimensions: { actionType: 'PutObject' },
                  },
                  {
                    sum: { requests: 60 },
                    dimensions: { actionType: 'GetObject' },
                  },
                ],
                r2StorageAdaptiveGroups: [
                  {
                    max: { payloadSize: 1000, metadataSize: 100 },
                    dimensions: {
                      bucketName: 'sungrid-staging-catalog',
                      datetime: '2026-07-12T10:00:00Z',
                    },
                  },
                ],
                hyperdriveQueriesAdaptiveGroups: [{ count: 12 }],
              },
            ],
          },
        },
      }),
    );
  }
  if (pathname.endsWith('/subscriptions')) {
    return response([
      {
        state: 'Provisioned',
        price: 0,
        rate_plan: {
          id: 'unrelated-account-plan',
          externally_managed: false,
          is_contract: false,
          scope: 'account',
          sets: null,
        },
      },
      {
        state: 'Provisioned',
        price: 0,
        rate_plan: {
          id: 'free',
          externally_managed: false,
          is_contract: false,
          scope: 'workers',
          sets: ['workers'],
        },
      },
    ]);
  }
  if (pathname.endsWith('/workers/account-settings'))
    return response({ default_usage_model: 'bundled' });
  if (pathname.endsWith('/workers/scripts/sungrid-staging/settings')) {
    return response({
      usage_model: 'bundled',
      limits: { cpu_ms: 10, subrequests: 50 },
    });
  }
  if (pathname.endsWith('/workers/scripts/sungrid-staging/subdomain'))
    return response({ enabled: false, previews_enabled: false });
  if (pathname.endsWith('/workers/scripts'))
    return response([{ id: 'sungrid-staging', routes: [] }]);
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
  if (pathname.endsWith('/r2/metrics')) {
    return response({
      standard: {
        published: { metadataSize: 100, objects: 30, payloadSize: 1000 },
        uploaded: { metadataSize: 100, objects: 30, payloadSize: 1000 },
      },
      infrequentAccess: {
        published: { metadataSize: 0, objects: 0, payloadSize: 0 },
        uploaded: { metadataSize: 0, objects: 0, payloadSize: 0 },
      },
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
    const subscriptionMethods: string[] = [];
    const recordingFetcher = (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions'))
        subscriptionMethods.push(init?.method ?? 'GET');
      return freeFetcher(input);
    };
    const evidence = await verifyFreeBoundary(config, recordingFetcher);

    expect(evidence).toMatchObject({
      result: 'passed',
      plan: 'Workers Free',
      workerUsageModel: 'bundled',
      subscriptionReadback: true,
      workerSubscriptionPresent: true,
      workerSubscriptionRatePlan: 'free',
      workerSubscriptionState: 'Provisioned',
      workerSubscriptionExternallyManaged: false,
      workerSubscriptionContract: false,
      workersPaidSubscriptionPresent: false,
      deployedCpuMsPerInvocation: 10,
      deployedExternalSubrequestsPerInvocation: 50,
      workersDevEnabled: false,
      previewUrlsEnabled: false,
      workerRoutes: [],
      accountCronTriggers: 1,
      r2StorageClass: 'Standard',
      r2DevEnabled: false,
      r2CustomDomains: 0,
      r2ObservedStandardObjects: 30,
      r2ObservedInfrequentAccessObjects: 0,
      r2PublishedObjectReadbacks: 29,
      hyperdriveCachingDisabled: true,
      hyperdriveOriginConnectionLimit: 20,
      observedDailyUsage: {
        workerRequests: 25,
        workerCpuTimeP99Ms: 5,
        r2ClassAOperations: 40,
        r2ClassBOperations: 60,
        r2FreeOperations: 0,
        r2CurrentStoredBytes: 1100,
        r2StorageGbMonth: 1100 / 1_000_000_000 / 30,
        hyperdriveQueries: 12,
      },
    });
    expect(evidence).not.toHaveProperty('automaticProviderUpgradeAuthorized');
    expect(subscriptionMethods).toEqual(['GET']);
  });

  it('accepts a Workers Free account whose only subscription record is unrelated', async () => {
    // Redacted live shape from run 29221583280: one subscription record,
    // scope=account, sets=null, id unrelated to Workers. Workers Free is not
    // an add-on subscription, so no Workers record exists on the account.
    const noWorkersFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'unrelated-account-plan',
              externally_managed: false,
              is_contract: false,
              scope: 'account',
              sets: null,
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const evidence = await verifyFreeBoundary(config, noWorkersFetcher);

    expect(evidence).toMatchObject({
      result: 'passed',
      plan: 'Workers Free',
      subscriptionReadback: true,
      workerSubscriptionPresent: false,
      workersPaidSubscriptionPresent: false,
      planEvidence:
        'no Workers subscription record; Workers Free needs no add-on subscription',
    });
    expect(evidence).not.toHaveProperty('workerSubscriptionRatePlan');
    expect(evidence).not.toHaveProperty('workerSubscriptionState');
  });

  it('fails closed on an unrecognized Workers-like subscription identity', async () => {
    const nearMissFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'workers_legacy',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const error = await verifyFreeBoundary(config, nearMissFetcher).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    if (!(error instanceof Error)) throw new Error('Expected a rejection');
    expect(error.message).toBe(
      'Workers subscription identity is unrecognized (matched=0 total=1; ' +
        'id=unrelated workersLike=true scope=user sets=absent state=unrelated zeroPrice=unrelated)',
    );
    expect(error.message).not.toContain('workers_legacy');
  });

  it('fails closed on a Workers-like sets element the classifier does not match', async () => {
    const setsNearMissFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'paid_compute',
              externally_managed: false,
              is_contract: false,
              scope: 'account',
              sets: ['workers_paid'],
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const error = await verifyFreeBoundary(config, setsNearMissFetcher).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    if (!(error instanceof Error)) throw new Error('Expected a rejection');
    expect(error.message).toBe(
      'Workers subscription identity is unrecognized (matched=0 total=1; ' +
        'id=unrelated workersLike=true scope=account sets=array(1,workers=false) state=unrelated zeroPrice=unrelated)',
    );
    expect(error.message).not.toContain('paid_compute');
    expect(error.message).not.toContain('workers_paid');
  });

  it('fails closed when a Workers-like entry coexists with the identified subscription', async () => {
    const coexistenceFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'free',
              externally_managed: false,
              is_contract: false,
              scope: 'workers',
              sets: ['workers'],
            },
          },
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'workers_legacy',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const error = await verifyFreeBoundary(config, coexistenceFetcher).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    if (!(error instanceof Error)) throw new Error('Expected a rejection');
    expect(error.message).toBe(
      'Workers subscription identity is unrecognized (matched=1 total=2; ' +
        'id=free workersLike=true scope=workers sets=array(1,workers=true) state=Provisioned zeroPrice=true; ' +
        'id=unrelated workersLike=true scope=user sets=absent state=unrelated zeroPrice=unrelated)',
    );
    expect(error.message).not.toContain('workers_legacy');
  });

  it('identifies the Workers subscription by rate plan id without scope or sets', async () => {
    const idOnlyFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'unrelated-account-plan',
              externally_managed: false,
              is_contract: false,
              scope: 'account',
              sets: null,
            },
          },
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'workers_free',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
              sets: null,
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const evidence = await verifyFreeBoundary(config, idOnlyFetcher);

    expect(evidence).toMatchObject({
      result: 'passed',
      plan: 'Workers Free',
      workerSubscriptionRatePlan: 'workers_free',
      workerSubscriptionState: 'Provisioned',
      workersPaidSubscriptionPresent: false,
    });
  });

  it('blocks a Workers Paid subscription identified only by rate plan id', async () => {
    const paidIdFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'WORKERS_PAID',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
              sets: null,
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, paidIdFetcher)).rejects.toThrow(
      'Workers Paid subscription is enabled',
    );
  });

  it('reports redacted classification when no Workers subscription matches', async () => {
    const unrelatedOnlyFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            id: 'subscription-record-id',
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'unrelated-account-plan',
              externally_managed: false,
              is_contract: false,
              scope: 'account',
              sets: null,
            },
          },
          {
            id: 'other-subscription-record-id',
            state: 'Paid',
            price: 25,
            rate_plan: {
              id: 'business',
              externally_managed: false,
              is_contract: false,
              scope: 'zone',
              sets: ['zone'],
            },
          },
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'workers_legacy',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    const error = await verifyFreeBoundary(config, unrelatedOnlyFetcher).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    if (!(error instanceof Error)) throw new Error('Expected a rejection');
    expect(error.message).toBe(
      'Workers subscription identity is unrecognized (matched=0 total=3; ' +
        'id=unrelated workersLike=false scope=account sets=null state=unrelated zeroPrice=unrelated; ' +
        'id=unrelated workersLike=false scope=zone sets=array(1,workers=false) state=unrelated zeroPrice=unrelated; ' +
        'id=unrelated workersLike=true scope=user sets=absent state=unrelated zeroPrice=unrelated)',
    );
    expect(error.message).not.toContain('unrelated-account-plan');
    expect(error.message).not.toContain('business');
    expect(error.message).not.toContain('subscription-record-id');
    expect(error.message).not.toContain('workers_legacy');
    expect(error.message).not.toContain('other-account-plan');
  });

  it('reports redacted classification when the Workers subscription is ambiguous', async () => {
    const ambiguousFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'workers_free',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
              sets: null,
            },
          },
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'workers_paid',
              externally_managed: false,
              is_contract: false,
              scope: 'user',
              sets: 'unexpected',
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, ambiguousFetcher)).rejects.toThrow(
      'Workers subscription identity is ambiguous (matched=2 total=2; ' +
        'id=workers_free workersLike=true scope=user sets=null state=Provisioned zeroPrice=true; ' +
        'id=workers_paid workersLike=true scope=user sets=string state=Paid zeroPrice=false)',
    );
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

  it('blocks a legacy Bundled Worker when a paid subscription exists', async () => {
    const paidFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Paid',
            price: 5,
            rate_plan: {
              id: 'pro',
              externally_managed: false,
              is_contract: false,
              scope: 'workers',
              sets: ['workers'],
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, paidFetcher)).rejects.toThrow(
      'Workers Paid subscription is enabled',
    );
  });

  it('blocks a Workers plan managed by an external subscription authority', async () => {
    const externallyManagedFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'free',
              externally_managed: true,
              is_contract: false,
              scope: 'workers',
              sets: ['workers'],
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(
      verifyFreeBoundary(config, externallyManagedFetcher),
    ).rejects.toThrow('Workers plan has an external upgrade authority');
  });

  it('blocks a Workers plan governed by a contract', async () => {
    const contractFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/subscriptions')) {
        return response([
          {
            state: 'Provisioned',
            price: 0,
            rate_plan: {
              id: 'free',
              externally_managed: false,
              is_contract: true,
              scope: 'workers',
              sets: ['workers'],
            },
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, contractFetcher)).rejects.toThrow(
      'Workers plan has a contract upgrade authority',
    );
  });

  it('blocks an account-level Worker route from any zone', async () => {
    const routedFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/workers/scripts')) {
        return response([
          {
            id: 'sungrid-staging',
            routes: [
              {
                id: 'route-in-another-zone',
                pattern: 'other-zone.example/*',
                script: 'sungrid-staging',
              },
            ],
          },
        ]);
      }
      return freeFetcher(input);
    };

    await expect(verifyFreeBoundary(config, routedFetcher)).rejects.toThrow(
      'Unexpected public Worker route',
    );
  });

  it('fails closed when the account route inventory is missing', async () => {
    const missingRoutesFetcher = (input: string | URL | Request) => {
      const { pathname } = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      if (pathname.endsWith('/workers/scripts'))
        return response([{ id: 'sungrid-staging' }]);
      return freeFetcher(input);
    };

    await expect(
      verifyFreeBoundary(config, missingRoutesFetcher),
    ).rejects.toThrow('Worker route inventory is missing');
  });
});
