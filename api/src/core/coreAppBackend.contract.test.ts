import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import session from 'express-session';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createCoreAppBackend,
  type CoreAppBackendDependencies,
} from './coreAppBackend.js';
import { createMemoryUcsdAuthStore } from '../auth/ucsdAuth.memory.js';
import { expressAppSession } from '../auth/ucsdAuth.session.js';
import {
  createUnlimitedVerificationAttemptLimiter,
  createUnlimitedVerificationRequestLimiter,
} from '../auth/verificationRequest.limiter.js';
import { createFilesystemPublishedSnapshotStore } from '../catalog/publishedSnapshot.filesystem.js';
import { createMemoryPublishedSnapshotStore } from '../catalog/publishedSnapshot.memory.js';
import { createMemorySavedSearchStore } from '../savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../savedWorksheets/savedWorksheets.memory.js';

export interface CoreHttpContractClient {
  fork: () => CoreHttpContractClient;
  get: (pathname: string) => Promise<Response>;
  post: (pathname: string, body?: unknown) => Promise<Response>;
}

class ContractClient implements CoreHttpContractClient {
  #cookie = '';
  readonly origin: string;
  readonly forwardedHttps: boolean;

  constructor(origin: string, forwardedHttps = false) {
    this.origin = origin;
    this.forwardedHttps = forwardedHttps;
  }

  async request(pathname: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.forwardedHttps) headers.set('x-forwarded-proto', 'https');
    if (this.#cookie) headers.set('cookie', this.#cookie);
    if (init.body && !headers.has('content-type'))
      headers.set('content-type', 'application/json');

    const response = await fetch(`${this.origin}${pathname}`, {
      ...init,
      headers,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.#cookie = setCookie.split(';')[0]!;
    return response;
  }

  get(pathname: string) {
    return this.request(pathname);
  }

  post(pathname: string, body?: unknown) {
    return this.request(pathname, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  fork() {
    return new ContractClient(this.origin, this.forwardedHttps);
  }
}

async function listen(app: express.Express, forwardedHttps: boolean) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Core contract server did not bind a TCP port');

  return {
    client: new ContractClient(
      `http://127.0.0.1:${address.port}`,
      forwardedHttps,
    ),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

function createContractDependencies(
  publishedSnapshots: CoreAppBackendDependencies['publishedSnapshots'],
): CoreAppBackendDependencies {
  return {
    auth: {
      store: createMemoryUcsdAuthStore(),
      emailSender: { sendVerificationEmail: () => Promise.resolve() },
      exposeVerificationCode: true,
      codeGenerator: () => '123456',
      now: () => 1_000_000,
      requestCooldownMs: 1,
      requestLimiter: createUnlimitedVerificationRequestLimiter(),
      verificationAttemptLimiter: createUnlimitedVerificationAttemptLimiter(),
    },
    publishedSnapshots,
    savedSearches: createMemorySavedSearchStore(),
    savedWorksheets: createMemorySavedWorksheetStore(),
    session: expressAppSession,
  };
}

async function startMemoryCompositionRoot() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'memory-contract-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, sameSite: 'lax' },
    }),
  );
  app.use(
    createCoreAppBackend(
      createContractDependencies(
        createMemoryPublishedSnapshotStore({
          metadata: JSON.stringify({ currentTerm: 'FA26' }),
          snapshots: {
            FA26: JSON.stringify({
              run_id: 'contract-run',
              generated_at: '2026-07-11T00:00:00.000Z',
              active_planning_term: 'FA26',
              courses: [{ course_id: 'CSE-100' }],
            }),
          },
          details: {
            FA26: JSON.stringify({
              run_id: 'contract-run',
              generated_at: '2026-07-11T00:00:00.000Z',
              active_planning_term: 'FA26',
              courses: [{ course_id: 'CSE-100', grade_archive_records: [] }],
            }),
          },
        }),
      ),
    ),
  );
  return await listen(app, false);
}

async function startNodeFilesystemCompositionRoot() {
  const staticDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'core-contract-'),
  );
  await mkdir(path.join(staticDirectory, 'catalogs/public'), {
    recursive: true,
  });
  await writeFile(
    path.join(staticDirectory, 'metadata.json'),
    JSON.stringify({ currentTerm: 'FA26' }),
  );
  await writeFile(
    path.join(staticDirectory, 'catalogs/public/FA26.json'),
    JSON.stringify({
      run_id: 'contract-run',
      generated_at: '2026-07-11T00:00:00.000Z',
      active_planning_term: 'FA26',
      courses: [
        {
          course_id: 'CSE-100',
          grade_archive_records: [],
        },
      ],
    }),
  );

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(
    session({
      secret: 'node-contract-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: true, sameSite: 'none' },
    }),
  );
  app.use(
    createCoreAppBackend(
      createContractDependencies(
        createFilesystemPublishedSnapshotStore(staticDirectory),
      ),
    ),
  );
  const server = await listen(app, true);
  return {
    ...server,
    async close() {
      await server.close();
      await rm(staticDirectory, { recursive: true, force: true });
    },
  };
}

async function signIn(client: CoreHttpContractClient, email: string) {
  const requested = await client.post('/api/auth/ucsd/request-verification', {
    email,
  });
  expect(requested.status).toBe(200);
  const verified = await client.post('/api/auth/ucsd/verify', {
    email,
    code: '123456',
  });
  expect(verified.status).toBe(200);
  return verified;
}

export async function exerciseCoreHttpContract(client: CoreHttpContractClient) {
  const ping = await client.get('/api/ping');
  expect(ping.status).toBe(200);
  expect(await ping.json()).toBe('pong');

  const metadata = await client.get('/api/catalog/metadata');
  expect(metadata.status).toBe(200);
  expect(metadata.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(await metadata.json()).toEqual({ currentTerm: 'FA26' });

  const snapshot = await client.get('/api/catalog/public/FA26');
  expect(snapshot.status).toBe(200);
  expect(await snapshot.json()).toEqual({
    run_id: 'contract-run',
    generated_at: '2026-07-11T00:00:00.000Z',
    active_planning_term: 'FA26',
    courses: [{ course_id: 'CSE-100' }],
  });

  const details = await client.get('/api/catalog/details/FA26');
  expect(details.status).toBe(200);
  expect(await details.json()).toEqual({
    run_id: 'contract-run',
    generated_at: '2026-07-11T00:00:00.000Z',
    active_planning_term: 'FA26',
    courses: [{ course_id: 'CSE-100', grade_archive_records: [] }],
  });

  for (const pathname of [
    '/ferry/v1/graphql',
    '/api/auth/cas',
    '/api/catalog/refresh',
    '/api/friends/names',
  ])
    expect((await client.get(pathname)).status).toBe(404);

  const requestVerification = await client.post(
    '/api/auth/ucsd/request-verification',
    { email: 'student@ucsd.edu' },
  );
  expect(requestVerification.status).toBe(200);
  expect(await requestVerification.json()).toEqual({
    status: 'verification_sent',
    email: 'student@ucsd.edu',
    devCode: '123456',
  });

  const verify = await client.post('/api/auth/ucsd/verify', {
    email: 'student@ucsd.edu',
    code: '123456',
  });
  expect(verify.status).toBe(200);
  const verified = (await verify.json()) as {
    authenticated: boolean;
    user: { user_id: number; verified_email: string };
  };
  expect(verified.authenticated).toBe(true);
  expect(verified.user.verified_email).toBe('student@ucsd.edu');

  const restored = await client.get('/api/auth/current-user');
  expect(restored.status).toBe(200);
  expect(await restored.json()).toEqual(verified);

  const createdSearch = await client.post('/api/savedSearches/create', {
    name: 'Core contract search',
    queryString: '?subjects=CSE',
  });
  expect(createdSearch.status).toBe(200);
  const search = (await createdSearch.json()) as { id: number };
  const listedSearches = await client.get('/api/savedSearches');
  expect(listedSearches.status).toBe(200);
  expect(await listedSearches.json()).toMatchObject({
    data: [{ id: search.id, name: 'Core contract search' }],
  });

  const createdWorksheet = await client.post(
    '/api/savedWorksheets/from-anonymous',
    {
      name: 'Core contract worksheet',
      term: 'FA26',
      courses: [{ sectionId: 'CSE-100-A00', color: '#123456', hidden: false }],
    },
  );
  expect(createdWorksheet.status).toBe(200);
  const worksheet = (await createdWorksheet.json()) as { id: number };
  const restoredWorksheet = await client.get(
    `/api/savedWorksheets/${worksheet.id}`,
  );
  expect(restoredWorksheet.status).toBe(200);
  expect(await restoredWorksheet.json()).toMatchObject({
    id: worksheet.id,
    name: 'Core contract worksheet',
    term: 'FA26',
  });

  const otherUser = client.fork();
  await signIn(otherUser, 'other-student@ucsd.edu');
  const otherSearches = await otherUser.get('/api/savedSearches');
  expect(otherSearches.status).toBe(200);
  expect(await otherSearches.json()).toEqual({ data: [] });
  expect(
    (await otherUser.post('/api/savedSearches/delete', { id: search.id }))
      .status,
  ).toBe(404);
  expect(
    (await otherUser.get(`/api/savedWorksheets/${worksheet.id}`)).status,
  ).toBe(404);
  expect(
    (
      await otherUser.post(`/api/savedWorksheets/${worksheet.id}/rename`, {
        name: 'Unauthorized rename',
      })
    ).status,
  ).toBe(404);
  const ownerWorksheetAfterBoundaryCheck = await client.get(
    `/api/savedWorksheets/${worksheet.id}`,
  );
  expect(await ownerWorksheetAfterBoundaryCheck.json()).toMatchObject({
    id: worksheet.id,
    name: 'Core contract worksheet',
  });

  const logout = await client.post('/api/auth/logout');
  expect(logout.status).toBe(200);
  const anonymous = await client.get('/api/auth/current-user');
  expect(await anonymous.json()).toEqual({ authenticated: false, user: null });
  expect((await client.get('/api/savedSearches')).status).toBe(401);
}

describe('Core App Backend external HTTP contract', () => {
  const cleanup: (() => Promise<void>)[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((close) => close()));
  });

  it('runs unchanged against an in-memory composition root', async () => {
    const server = await startMemoryCompositionRoot();
    cleanup.push(server.close);

    await exerciseCoreHttpContract(server.client);
  });

  it('runs unchanged against the Node filesystem composition root', async () => {
    const server = await startNodeFilesystemCompositionRoot();
    cleanup.push(server.close);

    await exerciseCoreHttpContract(server.client);
  });

  it('fails closed before mounting routes when a required binding is missing', () => {
    const dependencies = createContractDependencies(
      createMemoryPublishedSnapshotStore({ metadata: '{}', snapshots: {} }),
    );
    expect(() =>
      createCoreAppBackend({
        ...dependencies,
        publishedSnapshots: undefined as never,
      }),
    ).toThrow('Core App Backend dependency missing: publishedSnapshots');
    expect(() =>
      createCoreAppBackend({
        ...dependencies,
        auth: {
          ...dependencies.auth,
          requestLimiter: undefined as never,
        },
      }),
    ).toThrow('Core App Backend dependency missing: auth.requestLimiter');
  });
});
