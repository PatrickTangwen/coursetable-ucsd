import http from 'node:http';
import express from 'express';
import session from 'express-session';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryUcsdAuthStore } from './ucsdAuth.memory.js';
import { registerUcsdAuthRoutes } from './ucsdAuth.routes.js';
import {
  appUserIdToLegacyNetId,
  hashVerificationCode,
  normalizeVerifiedUcsdEmail,
  type VerificationRecord,
} from './ucsdIdentity.js';
import type { VerificationEmailSender } from './verificationEmail.sender.js';
import { createMemorySavedSearchStore } from '../savedSearches/savedSearches.memory.js';
import { registerSavedSearchRoutes } from '../savedSearches/savedSearches.routes.js';

class TestClient {
  #origin = '';
  #cookie = '';

  async start(app: express.Express) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No test server address');
    this.#origin = `http://127.0.0.1:${address.port}`;
    return server;
  }

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.#cookie) headers.set('cookie', this.#cookie);
    if (init.body && !headers.has('content-type'))
      headers.set('content-type', 'application/json');

    const response = await fetch(`${this.#origin}${path}`, {
      ...init,
      headers,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.#cookie = setCookie.split(';')[0]!;
    return response;
  }
}

function createTestApp(
  now = () => 1_000_000,
  emailSender: VerificationEmailSender = {
    sendVerificationEmail: () => Promise.resolve(),
  },
  exposeVerificationCode = true,
) {
  const app = express();
  const memoryAuthStore = createMemoryUcsdAuthStore();
  const verificationRecords: VerificationRecord[] = [];
  const authStore = {
    ...memoryAuthStore,
    async createVerification(record: VerificationRecord) {
      verificationRecords.push(record);
      await memoryAuthStore.createVerification(record);
    },
  };
  const savedSearchStore = createMemorySavedSearchStore();

  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        sameSite: 'lax',
      },
    }),
  );
  registerUcsdAuthRoutes(app, {
    store: authStore,
    emailSender,
    exposeVerificationCode,
    codeGenerator: () => '123456',
    now,
  });
  registerSavedSearchRoutes(app, savedSearchStore);

  return { app, authStore, savedSearchStore, verificationRecords };
}

describe('UCSD auth identity', () => {
  it('normalizes only direct @ucsd.edu verified email addresses', () => {
    expect(normalizeVerifiedUcsdEmail(' Student@UCSD.edu ')).toBe(
      'student@ucsd.edu',
    );
    expect(normalizeVerifiedUcsdEmail('student@example.com')).toBeNull();
    expect(normalizeVerifiedUcsdEmail('student@eng.ucsd.edu')).toBeNull();
  });

  it('keeps legacy netId adapters derived from user_id, not email local-part', () => {
    expect(appUserIdToLegacyNetId(1)).toBe('u0000001');
    expect(appUserIdToLegacyNetId(35)).toBe('u000000z');
  });
});

describe('UCSD auth routes', () => {
  let server = http.createServer();
  let client = new TestClient();

  beforeEach(async () => {
    const { app } = createTestApp();
    client = new TestClient();
    server = await client.start(app);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('returns an anonymous current-user response without creating a session', async () => {
    const response = await client.request('/api/auth/current-user');

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('rejects non-UCSD email addresses with a product message', async () => {
    const response = await client.request(
      '/api/auth/ucsd/request-verification',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'student@example.com' }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'NON_UCSD_EMAIL',
      message: 'Use a UCSD email address ending in @ucsd.edu.',
    });
  });

  it('requests verification, verifies code, restores session, and logs out', async () => {
    const requestResponse = await client.request(
      '/api/auth/ucsd/request-verification',
      {
        method: 'POST',
        body: JSON.stringify({ email: ' Student@UCSD.edu ' }),
      },
    );

    expect(requestResponse.status).toBe(200);
    expect(requestResponse.headers.get('set-cookie')).toBeNull();
    expect(await requestResponse.json()).toEqual({
      status: 'verification_sent',
      email: 'student@ucsd.edu',
      devCode: '123456',
    });

    const verifyResponse = await client.request('/api/auth/ucsd/verify', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@ucsd.edu', code: '123456' }),
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get('set-cookie')).toContain('connect.sid=');
    expect(await verifyResponse.json()).toEqual({
      authenticated: true,
      user: {
        user_id: 1,
        verified_email: 'student@ucsd.edu',
      },
    });

    const currentResponse = await client.request('/api/auth/current-user');
    expect(currentResponse.status).toBe(200);
    expect(await currentResponse.json()).toEqual({
      authenticated: true,
      user: {
        user_id: 1,
        verified_email: 'student@ucsd.edu',
      },
    });

    const logoutResponse = await client.request('/api/auth/logout', {
      method: 'POST',
    });
    expect(logoutResponse.status).toBe(200);

    const anonymousResponse = await client.request('/api/auth/current-user');
    expect(await anonymousResponse.json()).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('passes the generated verification to the configured sender', async () => {
    const sent: unknown[] = [];
    const { app, verificationRecords } = createTestApp(() => 1_000_000, {
      sendVerificationEmail(verification) {
        sent.push(verification);
        return Promise.resolve();
      },
    });
    const isolatedClient = new TestClient();
    const isolatedServer = await isolatedClient.start(app);

    try {
      const response = await isolatedClient.request(
        '/api/auth/ucsd/request-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email: ' Student@UCSD.edu ' }),
        },
      );

      expect(response.status).toBe(200);
      expect(sent).toEqual([
        {
          email: 'student@ucsd.edu',
          code: '123456',
          expiresAt: 1_900_000,
        },
      ]);
      expect(verificationRecords).toEqual([
        {
          normalizedEmail: 'student@ucsd.edu',
          codeHash: hashVerificationCode('student@ucsd.edu', '123456'),
          createdAt: 1_000_000,
          expiresAt: 1_900_000,
        },
      ]);
      expect(JSON.stringify(verificationRecords)).not.toContain('123456');
    } finally {
      await new Promise<void>((resolve) => {
        isolatedServer.close(() => resolve());
      });
    }
  });

  it('does not expose devCode when using a hosted sender', async () => {
    const { app } = createTestApp(
      () => 1_000_000,
      { sendVerificationEmail: () => Promise.resolve() },
      false,
    );
    const isolatedClient = new TestClient();
    const isolatedServer = await isolatedClient.start(app);

    try {
      const response = await isolatedClient.request(
        '/api/auth/ucsd/request-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email: 'student@ucsd.edu' }),
        },
      );

      expect(await response.json()).toEqual({
        status: 'verification_sent',
        email: 'student@ucsd.edu',
      });
    } finally {
      await new Promise<void>((resolve) => {
        isolatedServer.close(() => resolve());
      });
    }
  });

  it('returns an operational failure when the sender fails', async () => {
    const { app } = createTestApp(() => 1_000_000, {
      sendVerificationEmail: () =>
        Promise.reject(new Error('verification delivery unavailable')),
    });
    app.use(
      (
        err: unknown,
        _req: express.Request,
        res: express.Response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _next: express.NextFunction,
      ) => {
        res.status(503).json({ error: String(err) });
      },
    );
    const isolatedClient = new TestClient();
    const isolatedServer = await isolatedClient.start(app);

    try {
      const response = await isolatedClient.request(
        '/api/auth/ucsd/request-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email: 'student@ucsd.edu' }),
        },
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'Error: verification delivery unavailable',
      });
    } finally {
      await new Promise<void>((resolve) => {
        isolatedServer.close(() => resolve());
      });
    }
  });
});

describe('Saved Search UCSD user_id ownership', () => {
  let server = http.createServer();
  let client = new TestClient();
  let savedSearchStore = createMemorySavedSearchStore();

  beforeEach(async () => {
    const { app, savedSearchStore: nextSavedSearchStore } = createTestApp();
    savedSearchStore = nextSavedSearchStore;
    client = new TestClient();
    server = await client.start(app);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  async function signIn() {
    await client.request('/api/auth/ucsd/request-verification', {
      method: 'POST',
      body: JSON.stringify({ email: 'saved@ucsd.edu' }),
    });
    await client.request('/api/auth/ucsd/verify', {
      method: 'POST',
      body: JSON.stringify({ email: 'saved@ucsd.edu', code: '123456' }),
    });
  }

  it('blocks protected saved-search APIs while anonymous', async () => {
    const response = await client.request('/api/savedSearches');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(savedSearchStore.recordsByUserId.size).toBe(0);
  });

  it('uses the signed-in UCSD app user_id for saved-search ownership', async () => {
    await signIn();

    const createResponse = await client.request('/api/savedSearches/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'Morning CSE', queryString: '?q=cse' }),
    });
    expect(createResponse.status).toBe(200);

    const listResponse = await client.request('/api/savedSearches');

    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as {
      data: {
        id: number;
        name: string;
        queryString: string;
        createdAt: unknown;
      }[];
    };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]).toMatchObject({
      id: 1,
      name: 'Morning CSE',
      queryString: '?q=cse',
    });
    expect(typeof listBody.data[0]!.createdAt).toBe('number');
    expect(savedSearchStore.recordsByUserId.get(1)).toHaveLength(1);
  });
});
