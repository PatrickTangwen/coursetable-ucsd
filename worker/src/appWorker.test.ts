import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAppWorker,
  handleAppWorkerRequest,
  type AppWorkerEnv,
  type HostedAppProviders,
} from './appWorker.js';
import type { R2CatalogBucket, R2CatalogObject } from './r2CatalogStore.js';
import type { UpstashRedisCommands } from './upstashRedis.js';
import { createMemoryUpstashRedis } from './upstashRedis.memory.js';
import { createMemoryEmailDeliveryAuditStore } from '../../api/src/auth/emailDeliveryAudit.memory.js';
import { HostedLoginCookieClient } from '../../api/src/auth/hostedLogin.contract.js';
import { createMemoryUcsdAuthStore } from '../../api/src/auth/ucsdAuth.memory.js';
import { createMemorySavedSearchStore } from '../../api/src/savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../../api/src/savedWorksheets/savedWorksheets.memory.js';

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
          detail_path: 'published-details/FA26/details.json',
        },
      ],
    }),
    'published-snapshots/FA26/snapshot.json': JSON.stringify([
      { course_id: 'CSE:100' },
    ]),
    'published-details/FA26/details.json': JSON.stringify({
      active_planning_term: 'FA26',
      courses: [{ course_id: 'CSE:100', grade_archive_records: [] }],
    }),
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
    PUBLIC_LOGIN_ENABLED: 'true',
    VERIFICATION_REQUEST_COOLDOWN_SECONDS: '1',
    VERIFICATION_SOURCE_LIMIT: '5',
    VERIFICATION_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_GLOBAL_LIMIT: '100',
    VERIFICATION_GLOBAL_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_SOURCE_LIMIT: '20',
    VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_EMAIL_LIMIT: '5',
    VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS: '900',
    APPLICATION_SAFETY_SEND_LIMIT: '1000',
    APPLICATION_SAFETY_SEND_WINDOW_SECONDS: '2592000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: '50000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS: '2592000',
    USAGE_ALLOWANCE_WORKER_REQUESTS: '10000000',
    USAGE_ALLOWANCE_R2_READS: '10000000',
    USAGE_ALLOWANCE_NEON_ACCOUNT_REQUESTS: '200000',
    USAGE_ALLOWANCE_UPSTASH_COMMANDS: '500000',
    USAGE_ALLOWANCE_RESEND_SENDS: '3000',
  } as unknown as AppWorkerEnv;
}

const context = {
  waitUntil() {},
} as unknown as ExecutionContext;

function memoryHostedProviders(redis: UpstashRedisCommands) {
  const codes = new Map<string, string[]>();
  let currentTime = 1_000_000;
  const providers: HostedAppProviders = {
    createAppDatabase: (() => {
      const database = {
        auth: createMemoryUcsdAuthStore(),
        emailDeliveryAudits: createMemoryEmailDeliveryAuditStore(),
        savedSearches: createMemorySavedSearchStore(),
        savedWorksheets: createMemorySavedWorksheetStore(),
        close: () => Promise.resolve(),
      };
      return () => database;
    })(),
    createEmailSender: () => ({
      sendVerificationEmail(message) {
        const code = /code is (?<code>\d{6})/u.exec(message.text)?.groups?.code;
        if (!code) throw new Error('Verification code missing from message');
        codes.set(message.recipient, [
          ...(codes.get(message.recipient) ?? []),
          code,
        ]);
        return Promise.resolve();
      },
    }),
    createRedis: () => redis,
    now() {
      currentTime += 2_000;
      return currentTime;
    },
  };
  return { providers, codes };
}

function createWorkerClient(
  providers: HostedAppProviders,
  environment: AppWorkerEnv,
) {
  const worker = createAppWorker(providers);
  const pending: Promise<unknown>[] = [];
  const trackingContext = {
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  } as unknown as ExecutionContext;
  const client = new HostedLoginCookieClient((request) =>
    worker.fetch(request, environment, trackingContext),
  );
  return {
    client,
    settle: () => Promise.all(pending),
    requestVerification: (email: string, source: string) =>
      client.request('/api/auth/ucsd/request-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'cf-connecting-ip': source },
      }),
    verify: (email: string, code: string, source: string) =>
      client.request('/api/auth/ucsd/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
        headers: { 'cf-connecting-ip': source },
      }),
  };
}

describe('hosted App Worker composition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('declares safety budgets, usage allowances, and deployment identity in Wrangler config', async () => {
    const config = await readFile(
      new URL('../wrangler.jsonc', import.meta.url),
      'utf8',
    );

    for (const name of [
      'APPLICATION_SAFETY_SEND_LIMIT',
      'APPLICATION_SAFETY_SEND_WINDOW_SECONDS',
      'APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT',
      'APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS',
      'USAGE_ALLOWANCE_WORKER_REQUESTS',
      'USAGE_ALLOWANCE_R2_READS',
      'USAGE_ALLOWANCE_NEON_ACCOUNT_REQUESTS',
      'USAGE_ALLOWANCE_UPSTASH_COMMANDS',
      'USAGE_ALLOWANCE_RESEND_SENDS',
    ])
      expect(config).toContain(`"${name}"`);

    expect(config).toContain('"version_metadata"');
    expect(config).toContain('"CF_VERSION_METADATA"');
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

  it('keeps Catalog public but closes new login entry points when public login is disabled', async () => {
    const redis = createMemoryUpstashRedis();
    const { providers } = memoryHostedProviders(redis);
    const environment = {
      ...configuredEnvironment(),
      PUBLIC_LOGIN_ENABLED: 'false',
    } as AppWorkerEnv;

    for (const pathname of [
      '/api/auth/ucsd/request-verification',
      '/api/auth/ucsd/verify',
    ]) {
      const response = await handleAppWorkerRequest(
        new Request(`https://sungridplanner.com${pathname}`, {
          method: 'POST',
          body: JSON.stringify({
            email: 'student@ucsd.edu',
            code: '000000',
          }),
          headers: { 'content-type': 'application/json' },
        }),
        environment,
        context,
        providers,
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
    }

    const metadata = await handleAppWorkerRequest(
      new Request('https://sungridplanner.com/api/catalog/metadata'),
      environment,
      context,
      providers,
    );
    expect(metadata.status).toBe(200);
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

  it('fails abuse-prone writes closed at the application safety budget while Catalog, Sessions, and safe reads continue', async () => {
    const redis = createMemoryUpstashRedis();
    const { providers, codes } = memoryHostedProviders(redis);
    const environment = {
      ...configuredEnvironment(),
      APPLICATION_SAFETY_SEND_LIMIT: '2',
      APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: '1',
    } as AppWorkerEnv;
    const { client, requestVerification, verify } = createWorkerClient(
      providers,
      environment,
    );

    const firstSend = await requestVerification(
      'student@ucsd.edu',
      '198.51.100.1',
    );
    expect(firstSend.status).toBe(200);
    const code = codes.get('student@ucsd.edu')?.shift();
    const login = await verify('student@ucsd.edu', code!, '198.51.100.1');
    expect(login.status).toBe(200);

    const firstWrite = await client.request('/api/savedSearches/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'CSE', queryString: 'course=CSE100' }),
    });
    expect(firstWrite.status).toBe(200);

    const pausedWrite = await client.request('/api/savedSearches/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'MATH', queryString: 'course=MATH20' }),
    });
    expect(pausedWrite.status).toBe(503);
    expect(pausedWrite.headers.get('cache-control')).toBe('no-store');
    expect(await pausedWrite.json()).toEqual({
      error: 'ACCOUNT_WRITES_PAUSED',
      message: 'Account changes are temporarily paused.',
    });

    const safeRead = await client.get('/api/savedSearches');
    expect(safeRead.status).toBe(200);
    const safeReadBody = JSON.parse(await safeRead.text()) as {
      data: unknown[];
    };
    expect(safeReadBody.data).toHaveLength(1);

    const currentUser = await client.get('/api/auth/current-user');
    expect(currentUser.status).toBe(200);
    expect(await currentUser.json()).toMatchObject({ authenticated: true });

    const secondSend = await requestVerification(
      'second@ucsd.edu',
      '198.51.100.2',
    );
    expect(secondSend.status).toBe(200);

    const pausedSend = await requestVerification(
      'third@ucsd.edu',
      '198.51.100.3',
    );
    expect(pausedSend.status).toBe(503);
    const pausedSendBody = await pausedSend.text();
    expect(JSON.parse(pausedSendBody)).toEqual({
      error: 'VERIFICATION_SENDS_PAUSED',
      message: 'New verification emails are temporarily paused.',
    });
    expect(pausedSendBody).not.toContain('devCode');
    expect(codes.has('third@ucsd.edu')).toBe(false);

    const stillAuthenticated = await client.get('/api/auth/current-user');
    expect(await stillAuthenticated.json()).toMatchObject({
      authenticated: true,
    });

    const metadata = await client.get('/api/catalog/metadata');
    expect(metadata.status).toBe(200);

    for (const pathname of [
      '/ferry/v1/graphql',
      '/api/auth/cas',
      '/api/catalog/refresh',
      '/api/friends/names',
      '/api/email-delivery-audits',
    ]) {
      const legacy = await client.get(pathname);
      expect(legacy.status).toBe(404);
      expect(await legacy.text()).not.toMatch(/r2\.dev|workers\.dev/u);
    }
  });

  it('does not write verification state after the send safety budget is exhausted', async () => {
    const redis = createMemoryUpstashRedis();
    const { providers: baseProviders } = memoryHostedProviders(redis);
    const { createAppDatabase } = baseProviders;
    let verificationStateWrites = 0;
    const providers: HostedAppProviders = {
      ...baseProviders,
      createAppDatabase(binding) {
        const database = createAppDatabase(binding);
        const { auth } = database;
        return {
          ...database,
          auth: {
            ...auth,
            reserveVerification(record, cooldownMs) {
              verificationStateWrites += 1;
              return auth.reserveVerification(record, cooldownMs);
            },
            markVerificationFailed(verificationId) {
              verificationStateWrites += 1;
              return auth.markVerificationFailed(verificationId);
            },
          },
        };
      },
    };
    const environment = {
      ...configuredEnvironment(),
      APPLICATION_SAFETY_SEND_LIMIT: '1',
    } as AppWorkerEnv;
    const { requestVerification } = createWorkerClient(providers, environment);

    const first = await requestVerification(
      'student@ucsd.edu',
      '198.51.100.10',
    );
    expect(first.status).toBe(200);
    const writesAtCap = verificationStateWrites;

    const paused = await requestVerification(
      'second@ucsd.edu',
      '198.51.100.11',
    );

    expect(paused.status).toBe(503);
    expect(await paused.json()).toMatchObject({
      error: 'VERIFICATION_SENDS_PAUSED',
    });
    expect(verificationStateWrites).toBe(writesAtCap);
  });

  it('enforces source, global send, and guessing budgets through the Worker runtime', async () => {
    const redis = createMemoryUpstashRedis();
    const { providers, codes } = memoryHostedProviders(redis);
    const environment = {
      ...configuredEnvironment(),
      VERIFICATION_SOURCE_LIMIT: '1',
      VERIFICATION_GLOBAL_LIMIT: '2',
      VERIFICATION_ATTEMPT_EMAIL_LIMIT: '2',
    } as AppWorkerEnv;
    const { requestVerification, verify } = createWorkerClient(
      providers,
      environment,
    );

    const first = await requestVerification('student@ucsd.edu', '203.0.113.1');
    expect(first.status).toBe(200);

    const sameSource = await requestVerification(
      'another@ucsd.edu',
      '203.0.113.1',
    );
    expect(sameSource.status).toBe(429);
    expect(sameSource.headers.get('retry-after')).toBe('60');
    expect(await sameSource.json()).toMatchObject({
      error: 'VERIFICATION_RATE_LIMIT',
    });

    const second = await requestVerification('second@ucsd.edu', '203.0.113.2');
    expect(second.status).toBe(200);

    const globalExhausted = await requestVerification(
      'third@ucsd.edu',
      '203.0.113.3',
    );
    expect(globalExhausted.status).toBe(429);
    expect(await globalExhausted.json()).toMatchObject({
      error: 'VERIFICATION_RATE_LIMIT',
    });

    for (const attempt of [1, 2]) {
      const wrongCode = await verify(
        'student@ucsd.edu',
        '000000',
        '203.0.113.9',
      );
      expect(wrongCode.status, `attempt ${attempt}`).toBe(400);
      expect(await wrongCode.json()).toMatchObject({
        error: 'INVALID_VERIFICATION_CODE',
      });
    }
    const guessLimited = await verify(
      'student@ucsd.edu',
      '000000',
      '203.0.113.9',
    );
    expect(guessLimited.status).toBe(429);
    expect(await guessLimited.json()).toMatchObject({
      error: 'VERIFICATION_ATTEMPT_LIMIT',
    });

    const realCode = codes.get('student@ucsd.edu')?.shift();
    expect(realCode).toBeDefined();
  });

  it('records provider usage signals for catalog and account traffic', async () => {
    const redis = createMemoryUpstashRedis();
    const { providers } = memoryHostedProviders(redis);
    const environment = configuredEnvironment();
    const { client, requestVerification, settle } = createWorkerClient(
      providers,
      environment,
    );

    const metadata = await client.get('/api/catalog/metadata');
    expect(metadata.status).toBe(200);
    const send = await requestVerification('student@ucsd.edu', '198.51.100.7');
    expect(send.status).toBe(200);
    await settle();

    expect(redis.counters.get('usage:workers:1970-01')).toBe(2);
    expect(redis.counters.get('usage:r2:1970-01')).toBe(1);
    expect(redis.counters.get('usage:neon:1970-01')).toBe(1);
    // Catalog request: its one usage-recording command. Account request:
    // source admission, global and safety preflights, both budget
    // consumptions, plus its one usage-recording command.
    expect(redis.counters.get('usage:upstash:1970-01')).toBe(7);
    expect(redis.counters.get('usage:resend:1970-01')).toBe(1);
  });

  it('reports usage levels for every provider from the scheduled handler', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const redis = createMemoryUpstashRedis();
    redis.counters.set('usage:resend:1970-01', 2_800);
    const { providers } = memoryHostedProviders(redis);
    const pending: Promise<unknown>[] = [];
    const worker = createAppWorker(providers);
    worker.scheduled(
      {
        scheduledTime: Date.parse('2026-07-12T08:00:00.000Z'),
        cron: '0 8 * * *',
        noRetry() {},
      },
      configuredEnvironment(),
      {
        waitUntil(promise: Promise<unknown>) {
          pending.push(promise);
        },
      } as unknown as ExecutionContext,
    );
    await Promise.all(pending);

    const report = warn.mock.calls
      .map(([line]) => line as string)
      .find((line) => line.includes('"signal":"usage-report"'));
    expect(report).toBeDefined();
    const parsed = JSON.parse(report!) as {
      reports: { provider: string; level: string }[];
    };
    expect(parsed.reports.map((entry) => entry.provider)).toEqual([
      'workers',
      'r2',
      'neon',
      'upstash',
      'resend',
    ]);
    expect(parsed.reports.at(-1)).toMatchObject({
      provider: 'resend',
      level: 'urgent',
      used: 2_800,
      allowance: 3_000,
    });
    expect(redis.counters.get('usage:workers:1970-01')).toBe(1);
    expect(redis.counters.get('usage:neon:1970-01')).toBe(1);
    // Five report reads plus the one batched usage-recording command.
    expect(redis.counters.get('usage:upstash:1970-01')).toBe(6);
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

      const details = await handleAppWorkerRequest(
        new Request(
          'https://staging.sungridplanner.com/api/catalog/details/FA26',
        ),
        environment as unknown as AppWorkerEnv,
        context,
      );
      expect(details.status).toBe(200);
      expect(await details.json()).toEqual({
        active_planning_term: 'FA26',
        courses: [{ course_id: 'CSE:100', grade_archive_records: [] }],
      });
    },
  );
});
