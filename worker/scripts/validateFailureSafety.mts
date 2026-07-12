// Failure and cost safety evidence for the hosted App Worker (issue #116).
// Drives the actual Worker composition in-process against disposable fake
// providers, proving bounded provider-failure behavior, application safety
// budget fail-closed semantics, public Catalog isolation, and route
// negatives, then prints one non-sensitive evidence line that records
// deployment identity. No hosted provider resource is touched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createMemoryEmailDeliveryAuditStore } from '../../api/src/auth/emailDeliveryAudit.memory.js';
import { createMemoryUcsdAuthStore } from '../../api/src/auth/ucsdAuth.memory.js';
import { VerificationEmailDeliveryError } from '../../api/src/auth/verificationEmail.sender.js';
import { createMemorySavedSearchStore } from '../../api/src/savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../../api/src/savedWorksheets/savedWorksheets.memory.js';
import { assertGeneralTelemetrySafe } from '../../api/src/telemetry/privacy.js';
import {
  createAppWorker,
  type AppWorkerEnv,
  type HostedAppProviders,
} from '../src/appWorker.js';
import {
  publishAcceptedCatalog,
  type CatalogPublicationStore,
} from '../src/catalogPublication.js';
import type { UpstashRedisCommands } from '../src/upstashRedis.js';

const origin = 'https://staging.sungridplanner.com';
const encoder = new TextEncoder();

class BudgetRedis implements UpstashRedisCommands {
  readonly values = new Map<string, string>();
  readonly counters = new Map<string, number>();

  get<T>(key: string) {
    if (this.counters.has(key))
      return Promise.resolve(this.counters.get(key) as T);
    const value = this.values.get(key);
    return Promise.resolve(value ? (JSON.parse(value) as T) : null);
  }

  setex(key: string, _seconds: number, value: string) {
    this.values.set(key, value);
    return Promise.resolve('OK' as const);
  }

  del(key: string) {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }

  eval(script: string, keys: string[], args: string[]) {
    if (script.includes('INCRBY')) {
      const next = (this.counters.get(keys[0]!) ?? 0) + Number(args[0]);
      this.counters.set(keys[0]!, next);
      return Promise.resolve(next);
    }
    if (script.includes('DEL')) {
      this.counters.delete(keys[0]!);
      return Promise.resolve(1);
    }
    if (keys.length === 2) {
      const source = this.counters.get(keys[0]!) ?? 0;
      const email = this.counters.get(keys[1]!) ?? 0;
      if (source >= Number(args[0]) || email >= Number(args[2]))
        return Promise.resolve([0, 60_000]);
      this.counters.set(keys[0]!, source + 1);
      this.counters.set(keys[1]!, email + 1);
      return Promise.resolve([1, 0]);
    }
    const count = this.counters.get(keys[0]!) ?? 0;
    if (count >= Number(args[0])) return Promise.resolve([0, 60_000]);
    this.counters.set(keys[0]!, count + 1);
    return Promise.resolve([1, 0]);
  }
}

function rejectingRedis(): UpstashRedisCommands {
  const down = () => Promise.reject(new Error('session store unavailable'));
  return { get: down, setex: down, del: down, eval: down };
}

function catalogBucket(failReads = false) {
  const objects = new Map<string, string>([
    [
      'metadata.json',
      JSON.stringify({
        terms: [
          {
            term: 'FA26',
            snapshot_path: 'published-snapshots/FA26/snapshot.json',
          },
        ],
      }),
    ],
    [
      'published-snapshots/FA26/snapshot.json',
      JSON.stringify([{ course_id: 'CSE:100' }]),
    ],
  ]);
  return {
    get(key: string) {
      if (failReads) return Promise.reject(new Error('R2 unavailable'));
      const body = objects.get(key);
      if (!body) return Promise.resolve(null);
      const bytes = encoder.encode(body);
      return Promise.resolve({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        size: bytes.byteLength,
        httpEtag: '"catalog-etag"',
        uploaded: new Date('2026-07-11T00:00:00.000Z'),
        writeHttpMetadata(headers: Headers) {
          headers.set('content-type', 'application/json; charset=utf-8');
        },
      });
    },
    put: () => Promise.resolve(),
  };
}

function environment(
  overrides: { [name in keyof AppWorkerEnv]?: unknown } = {},
) {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response('SunGrid')) },
    CATALOG_BUCKET: catalogBucket(),
    APP_DB_HYPERDRIVE_NO_CACHE: {
      connectionString: 'postgresql://local.invalid/app',
    },
    UPSTASH_REDIS_REST_URL: 'https://local-upstash.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'local-token',
    SESSION_SECRET: 'validation-session-secret',
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
    APPLICATION_SAFETY_SEND_LIMIT: '1000',
    APPLICATION_SAFETY_SEND_WINDOW_SECONDS: '2592000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: '50000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS: '2592000',
    USAGE_ALLOWANCE_WORKER_REQUESTS: '10000000',
    USAGE_ALLOWANCE_R2_READS: '10000000',
    USAGE_ALLOWANCE_NEON_ACCOUNT_REQUESTS: '200000',
    USAGE_ALLOWANCE_UPSTASH_ACCOUNT_REQUESTS: '80000',
    USAGE_ALLOWANCE_RESEND_SENDS: '3000',
    ...overrides,
  } as unknown as AppWorkerEnv;
}

interface ProviderOverrides {
  redis?: UpstashRedisCommands;
  sendVerificationEmail?: (message: { text: string }) => Promise<void>;
  failDatabase?: boolean;
}

function providers(overrides: ProviderOverrides = {}) {
  const codes = new Map<string, string[]>();
  const database = {
    auth: createMemoryUcsdAuthStore(),
    emailDeliveryAudits: createMemoryEmailDeliveryAuditStore(),
    savedSearches: createMemorySavedSearchStore(),
    savedWorksheets: createMemorySavedWorksheetStore(),
    close: () => Promise.resolve(),
  };
  const unavailable = () => Promise.reject(new Error('App DB unavailable'));
  const failingDatabase = {
    ...database,
    auth: {
      ...database.auth,
      reserveVerification: unavailable,
      consumeVerification: unavailable,
      findOrCreateUser: unavailable,
    },
    savedSearches: { ...database.savedSearches, listByUserId: unavailable },
  };
  let currentTime = 1_000_000;
  const redis = overrides.redis ?? new BudgetRedis();
  const hosted: HostedAppProviders = {
    createAppDatabase: () =>
      overrides.failDatabase ? failingDatabase : database,
    createEmailSender: () => ({
      sendVerificationEmail(message) {
        if (overrides.sendVerificationEmail)
          return overrides.sendVerificationEmail(message);
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
  return { hosted, codes };
}

class WorkerClient {
  #cookie = '';
  readonly fetch: (request: Request) => Promise<Response>;

  constructor(hosted: HostedAppProviders, workerEnvironment: AppWorkerEnv) {
    const worker = createAppWorker(hosted);
    const context = {
      waitUntil() {},
    } as unknown as ExecutionContext;
    this.fetch = (request) => worker.fetch(request, workerEnvironment, context);
  }

  async request(pathname: string, init: RequestInit = {}, source = 'unknown') {
    const headers = new Headers(init.headers);
    headers.set('cf-connecting-ip', source);
    if (this.#cookie) headers.set('cookie', this.#cookie);
    if (init.body) headers.set('content-type', 'application/json');
    const response = await this.fetch(
      new Request(`${origin}${pathname}`, { ...init, headers }),
    );
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.#cookie = setCookie.split(';')[0]!;
    return response;
  }

  requestVerification(email: string, source: string) {
    return this.request(
      '/api/auth/ucsd/request-verification',
      { method: 'POST', body: JSON.stringify({ email }) },
      source,
    );
  }
}

async function expectBounded(
  response: Response,
  status: number,
  error: string,
  label: string,
) {
  assert.ok(
    response.status === status,
    `${label} status ${response.status} instead of ${status}`,
  );
  const body = await response.text();
  assert.equal(
    (JSON.parse(body) as { error?: string }).error,
    error,
    `${label} error code`,
  );
  assert.ok(!body.includes('devCode'), `${label} exposed a development code`);
  assert.ok(
    !body.includes('r2.dev') && !body.includes('workers.dev'),
    `${label} exposed a provider-default URL`,
  );
  return error;
}

async function resendRejectionCheck() {
  const { hosted } = providers({
    sendVerificationEmail: () =>
      Promise.reject(
        new VerificationEmailDeliveryError(
          'provider rejected',
          'definitive_failure',
        ),
      ),
  });
  const client = new WorkerClient(hosted, environment());
  return expectBounded(
    await client.requestVerification('student@ucsd.edu', '203.0.113.1'),
    503,
    'VERIFICATION_DELIVERY_FAILED',
    'Resend rejection',
  );
}

async function resendAmbiguousCheck() {
  const { hosted } = providers({
    sendVerificationEmail: () =>
      Promise.reject(
        new VerificationEmailDeliveryError('provider timeout', 'ambiguous'),
      ),
  });
  const client = new WorkerClient(hosted, environment());
  return expectBounded(
    await client.requestVerification('student@ucsd.edu', '203.0.113.2'),
    503,
    'VERIFICATION_DELIVERY_UNCERTAIN',
    'Resend ambiguous delivery',
  );
}

// A validly signed session Cookie forces the session read to reach the
// unavailable store instead of short-circuiting as anonymous.
function signedSessionCookie(secret: string) {
  const sessionId = 'f'.repeat(64);
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64url');
  return `sungrid_session=${sessionId}.${signature}`;
}

async function upstashUnavailableCheck() {
  const { hosted } = providers({ redis: rejectingRedis() });
  const client = new WorkerClient(hosted, environment());
  await expectBounded(
    await client.requestVerification('student@ucsd.edu', '203.0.113.3'),
    503,
    'VERIFICATION_REQUEST_UNAVAILABLE',
    'Upstash-down verification',
  );
  await expectBounded(
    await client.request('/api/auth/current-user', {
      headers: { cookie: signedSessionCookie('validation-session-secret') },
    }),
    503,
    'AUTH_UNAVAILABLE',
    'Upstash-down session read',
  );
  const catalog = await client.request('/api/catalog/metadata');
  assert.equal(catalog.status, 200, 'Catalog survived Upstash outage');
  return 'VERIFICATION_REQUEST_UNAVAILABLE+AUTH_UNAVAILABLE';
}

async function neonUnavailableCheck() {
  const redis = new BudgetRedis();
  redis.values.set(
    `session:${'f'.repeat(64)}`,
    JSON.stringify({ user_id: 1, verified_email: 'student@ucsd.edu' }),
  );
  const { hosted } = providers({ redis, failDatabase: true });
  const client = new WorkerClient(hosted, environment());
  await expectBounded(
    await client.requestVerification('student@ucsd.edu', '203.0.113.4'),
    503,
    'AUTH_UNAVAILABLE',
    'Neon-down verification',
  );
  await expectBounded(
    await client.request('/api/savedSearches', {
      headers: { cookie: signedSessionCookie('validation-session-secret') },
    }),
    503,
    'ACCOUNT_DATA_UNAVAILABLE',
    'Neon-down planning data',
  );
  const catalog = await client.request('/api/catalog/metadata');
  assert.equal(catalog.status, 200, 'Catalog survived App DB outage');
  return 'AUTH_UNAVAILABLE+ACCOUNT_DATA_UNAVAILABLE';
}

async function r2ReadFailureCheck() {
  const { hosted, codes } = providers();
  const client = new WorkerClient(
    hosted,
    environment({ CATALOG_BUCKET: catalogBucket(true) }),
  );
  await expectBounded(
    await client.request('/api/catalog/metadata'),
    503,
    'CATALOG_UNAVAILABLE',
    'R2 read failure',
  );
  const assets = await client.request('/worksheet');
  assert.equal(assets.status, 200, 'Static assets survived R2 outage');
  const send = await client.requestVerification(
    'student@ucsd.edu',
    '203.0.113.5',
  );
  assert.equal(send.status, 200, 'Login path survived R2 outage');
  assert.ok(codes.has('student@ucsd.edu'), 'Verification email not captured');
  return 'CATALOG_UNAVAILABLE';
}

async function r2PublicationFailureCheck() {
  const snapshot = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      generated_at: '2026-07-11T00:00:00.000Z',
      courses: [],
    }),
  );
  const manifest = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      generated_at: '2026-07-11T00:00:00.000Z',
      summary: { ok: 1, empty: 0, failed: 0, partial: 0 },
      cells: [{ term: 'FA26', source: 'schedule_of_classes', status: 'ok' }],
    }),
  );
  const registry = encoder.encode(
    JSON.stringify({
      last_update: '2026-07-11T00:00:00.000Z',
      terms: [
        {
          term: 'FA26',
          label: 'Fall 2026',
          date_range: { start: '2026-09-24', end: '2026-12-12' },
          frozen: false,
          generated_at: '2026-07-11T00:00:00.000Z',
          snapshot_path: 'catalogs/public/FA26.json',
          manifest_path: 'catalogs/import-manifests/FA26.json',
        },
      ],
    }),
  );
  const digest = async (body: Uint8Array) => {
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      Uint8Array.from(body).buffer,
    );
    return [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };
  const input = {
    accepted: true as const,
    term: 'FA26',
    snapshot: {
      body: snapshot,
      size: snapshot.byteLength,
      sha256: await digest(snapshot),
    },
    manifest: {
      body: manifest,
      size: manifest.byteLength,
      sha256: await digest(manifest),
    },
    registry,
  };
  const written = new Map<string, Uint8Array>();
  const store: CatalogPublicationStore = {
    putObject(key, body) {
      if (key.startsWith('published-manifests/'))
        return Promise.reject(new Error('upload failed'));
      written.set(key, body);
      return Promise.resolve();
    },
  };

  await assert.rejects(
    publishAcceptedCatalog(input, store),
    /upload failed/u,
    'Publication failure did not surface',
  );
  assert.ok(
    !written.has('metadata.json'),
    'Publication failure switched the metadata pointer',
  );
  return 'metadata pointer preserved';
}

async function safetyBudgetCheck() {
  const { hosted, codes } = providers();
  const client = new WorkerClient(
    hosted,
    environment({
      APPLICATION_SAFETY_SEND_LIMIT: '1',
      APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: '1',
    }),
  );

  const firstSend = await client.requestVerification(
    'student@ucsd.edu',
    '198.51.100.1',
  );
  assert.equal(firstSend.status, 200, 'First verification send failed');
  const verificationCode = codes.get('student@ucsd.edu')?.shift();
  assert.ok(verificationCode, 'No captured verification code');
  const login = await client.request(
    '/api/auth/ucsd/verify',
    {
      method: 'POST',
      body: JSON.stringify({
        email: 'student@ucsd.edu',
        code: verificationCode,
      }),
    },
    '198.51.100.1',
  );
  assert.equal(login.status, 200, 'Login failed before the safety budget');

  const firstWrite = await client.request('/api/savedSearches/create', {
    method: 'POST',
    body: JSON.stringify({ name: 'CSE', queryString: 'course=CSE100' }),
  });
  assert.equal(firstWrite.status, 200, 'First account write failed');
  await expectBounded(
    await client.request('/api/savedSearches/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'MATH', queryString: 'course=MATH20' }),
    }),
    503,
    'ACCOUNT_WRITES_PAUSED',
    'Account write at safety budget',
  );

  await expectBounded(
    await client.requestVerification('second@ucsd.edu', '198.51.100.2'),
    503,
    'VERIFICATION_SENDS_PAUSED',
    'Verification send at safety budget',
  );
  assert.ok(!codes.has('second@ucsd.edu'), 'Paused send reached the provider');

  const safeRead = await client.request('/api/savedSearches');
  assert.equal(safeRead.status, 200, 'Safe account read failed');
  const currentUser = await client.request('/api/auth/current-user');
  assert.equal(currentUser.status, 200, 'Current-user read failed');
  const currentUserBody = JSON.parse(await currentUser.text()) as {
    authenticated?: boolean;
  };
  assert.equal(
    currentUserBody.authenticated,
    true,
    'Safety budget dropped the signed-in account',
  );
  const catalog = await client.request('/api/catalog/metadata');
  assert.equal(catalog.status, 200, 'Catalog failed at the safety budget');
  return 'VERIFICATION_SENDS_PAUSED+ACCOUNT_WRITES_PAUSED';
}

async function routeNegativeCheck() {
  const { hosted } = providers({ redis: rejectingRedis() });
  const client = new WorkerClient(
    hosted,
    environment({ CATALOG_BUCKET: catalogBucket(true) }),
  );
  for (const pathname of [
    '/ferry/v1/graphql',
    '/api/auth/cas',
    '/api/friends/names',
    '/api/catalog/refresh',
    '/api/email-delivery-audits',
    '/api/maintainer/email-delivery-audits',
    '/api/hasura/v1/graphql',
  ]) {
    const response = await client.request(pathname);
    assert.equal(response.status, 404, `${pathname} was unexpectedly routable`);
    const body = await response.text();
    assert.ok(
      !body.includes('r2.dev') && !body.includes('workers.dev'),
      `${pathname} exposed a provider-default URL`,
    );
  }
  return '404 with no provider-default surface';
}

async function deploymentIdentity() {
  // The 12-character short commit stays under the telemetry scrubber's
  // long-hex redaction threshold while still identifying the deployment.
  const gitCommit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const journal = JSON.parse(
    await readFile(
      new URL(
        '../../api/drizzle/migrations/meta/_journal.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { entries: { tag: string }[] };
  const schemaVersion = journal.entries.at(-1)?.tag;
  assert.ok(schemaVersion, 'No committed schema version');
  return { gitCommit, schemaVersion, workerConfig: 'worker/wrangler.jsonc' };
}

const evidence = {
  result: 'passed',
  surface: 'hosted App Worker failure and cost safety boundaries',
  deployment: await deploymentIdentity(),
  checks: {
    resendRejection: await resendRejectionCheck(),
    resendAmbiguousDelivery: await resendAmbiguousCheck(),
    upstashUnavailable: await upstashUnavailableCheck(),
    neonUnavailable: await neonUnavailableCheck(),
    r2ReadFailure: await r2ReadFailureCheck(),
    r2PublicationFailure: await r2PublicationFailureCheck(),
    applicationSafetyBudget: await safetyBudgetCheck(),
    failureRouteNegatives: await routeNegativeCheck(),
  },
  providerResourcesCreated: false,
};

assertGeneralTelemetrySafe(evidence);
console.log(JSON.stringify(evidence));
