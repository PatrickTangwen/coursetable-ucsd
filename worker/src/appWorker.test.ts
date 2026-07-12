import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  createAppWorker,
  handleAppWorkerRequest,
  type AppWorkerEnv,
  type HostedAppProviders,
} from './appWorker.js';
import type { R2CatalogBucket, R2CatalogObject } from './r2CatalogStore.js';

const encoder = new TextEncoder();

function catalogObject(body: string): R2CatalogObject {
  const bytes = encoder.encode(body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    size: bytes.byteLength,
    httpEtag: '"catalog-etag"',
    uploaded: new Date('2026-07-11T00:00:00.000Z'),
    writeHttpMetadata(headers) {
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('cache-control', 'public, max-age=3600');
    },
  };
}

function catalogBucket(): R2CatalogBucket {
  const objects: { [key: string]: string } = {
    'metadata.json': JSON.stringify({
      terms: [
        {
          term: 'FA26',
          snapshot_path: 'published-snapshots/FA26/snapshot.json',
        },
      ],
    }),
    'published-snapshots/FA26/snapshot.json': JSON.stringify([
      { course_id: 'CSE:100' },
    ]),
  };
  return {
    get: (key) =>
      Promise.resolve(objects[key] ? catalogObject(objects[key]) : null),
    put: () => Promise.resolve(),
  };
}

function incompleteEnvironment() {
  return {
    ASSETS: {
      fetch: () => Promise.resolve(new Response('SunGrid')),
    },
    CATALOG_BUCKET: catalogBucket(),
  } as unknown as AppWorkerEnv;
}

function configuredEnvironment() {
  return {
    ...incompleteEnvironment(),
    APP_DB_HYPERDRIVE_NO_CACHE: {
      connectionString: 'postgresql://local.invalid/app',
    },
    UPSTASH_REDIS_REST_URL: 'https://local-upstash.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'local-token',
    SESSION_SECRET: 'session-secret',
    RESEND_API_KEY: 'local-resend-key',
    VERIFICATION_EMAIL_SENDER_DOMAIN: 'validation.invalid',
    VERIFICATION_EMAIL_FROM_ADDRESS: 'login@validation.invalid',
    VERIFICATION_REQUEST_COOLDOWN_SECONDS: '1',
    VERIFICATION_SOURCE_LIMIT: '5',
    VERIFICATION_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_GLOBAL_LIMIT: '100',
    VERIFICATION_GLOBAL_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_SOURCE_LIMIT: '20',
    VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_EMAIL_LIMIT: '5',
    VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS: '900',
  } as unknown as AppWorkerEnv;
}

const context = {
  waitUntil() {},
} as unknown as ExecutionContext;

describe('hosted App Worker composition', () => {
  it('does not expose Email Delivery Audit through a browser route', async () => {
    for (const pathname of [
      '/api/email-delivery-audits',
      '/api/maintainer/email-delivery-audits',
    ]) {
      const response = await handleAppWorkerRequest(
        new Request(`https://staging.sungridplanner.com${pathname}`),
        incompleteEnvironment(),
        context,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('runs idempotent audit cleanup at the scheduled time and closes App DB', async () => {
    const cleanedAt: number[] = [];
    let closeCalls = 0;
    const providers = {
      createAppDatabase: () => ({
        auth: {},
        savedSearches: {},
        savedWorksheets: {},
        emailDeliveryAudits: {
          deleteExpired(now: number) {
            cleanedAt.push(now);
            return Promise.resolve(0);
          },
        },
        close() {
          closeCalls += 1;
          return Promise.resolve();
        },
      }),
      createEmailSender: () => ({
        sendVerificationEmail: () => Promise.resolve(),
      }),
      createRedis: () => ({}),
      now: Date.now,
    } as unknown as HostedAppProviders;
    const pending: Promise<unknown>[] = [];
    const { scheduled } = createAppWorker(providers) as unknown as {
      scheduled: (
        controller: ScheduledController,
        environment: AppWorkerEnv,
        executionContext: ExecutionContext,
      ) => void;
    };
    const scheduledTime = Date.parse('2026-07-12T08:00:00.000Z');

    scheduled(
      { scheduledTime, cron: '0 8 * * *', noRetry() {} },
      configuredEnvironment(),
      {
        waitUntil(promise) {
          pending.push(promise);
        },
      } as ExecutionContext,
    );
    await Promise.all(pending);

    expect(cleanedAt).toEqual([scheduledTime]);
    expect(closeCalls).toBe(1);
  });

  it('declares the daily audit cleanup schedule in Wrangler config', async () => {
    const config = await readFile(
      new URL('../wrangler.jsonc', import.meta.url),
      'utf8',
    );

    expect(config).toContain('"crons": ["0 8 * * *"]');
  });

  it('fails auth closed when hosted bindings are absent', async () => {
    const response = await handleAppWorkerRequest(
      new Request('https://staging.sungridplanner.com/api/auth/current-user'),
      incompleteEnvironment(),
      context,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: 'AUTH_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable.',
    });
  });

  it('keeps static assets available when account bindings are absent', async () => {
    const response = await handleAppWorkerRequest(
      new Request('https://staging.sungridplanner.com/'),
      incompleteEnvironment(),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SunGrid');
  });

  it('fails planning data closed when account bindings are absent', async () => {
    const response = await handleAppWorkerRequest(
      new Request('https://staging.sungridplanner.com/api/savedSearches'),
      incompleteEnvironment(),
      context,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: 'ACCOUNT_DATA_UNAVAILABLE',
      message: 'Account data is temporarily unavailable.',
    });
  });

  it.each([
    'APP_DB_HYPERDRIVE_NO_CACHE',
    'UPSTASH_REDIS_REST_TOKEN',
    'RESEND_API_KEY',
  ] as const)(
    'keeps the public Catalog and Anonymous Worksheet available without %s',
    async (missingBinding) => {
      const environment = configuredEnvironment() as unknown as {
        [key: string]: unknown;
      };
      delete environment[missingBinding];

      const response = await handleAppWorkerRequest(
        new Request('https://staging.sungridplanner.com/worksheet'),
        environment as unknown as AppWorkerEnv,
        context,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('SunGrid');

      const metadata = await handleAppWorkerRequest(
        new Request('https://staging.sungridplanner.com/api/catalog/metadata'),
        environment as unknown as AppWorkerEnv,
        context,
      );
      expect(metadata.status).toBe(200);
      expect(await metadata.json()).toMatchObject({
        terms: [{ term: 'FA26' }],
      });

      const snapshot = await handleAppWorkerRequest(
        new Request(
          'https://staging.sungridplanner.com/api/catalog/public/FA26',
        ),
        environment as unknown as AppWorkerEnv,
        context,
      );
      expect(snapshot.status).toBe(200);
      expect(await snapshot.json()).toEqual([{ course_id: 'CSE:100' }]);
    },
  );
});
