import http from 'node:http';
import express from 'express';
import session from 'express-session';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemorySavedWorksheetStore } from './savedWorksheets.memory.js';
import { registerSavedWorksheetRoutes } from './savedWorksheets.routes.js';
import { createMemoryUcsdAuthStore } from '../auth/ucsdAuth.memory.js';
import { registerUcsdAuthRoutes } from '../auth/ucsdAuth.routes.js';

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

function createTestApp(now = () => 1_000_000) {
  const app = express();
  const authStore = createMemoryUcsdAuthStore();
  const savedWorksheetStore = createMemorySavedWorksheetStore();

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
    exposeVerificationCode: true,
    codeGenerator: () => '123456',
    now,
  });
  registerSavedWorksheetRoutes(app, savedWorksheetStore, now);

  return { app, savedWorksheetStore };
}

async function signIn(client: TestClient, email: string) {
  await client.request('/api/auth/ucsd/request-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  await client.request('/api/auth/ucsd/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code: '123456' }),
  });
}

describe('Saved Worksheet save API', () => {
  let app = express();
  let server = http.createServer();
  let client = new TestClient();
  let savedWorksheetStore = createMemorySavedWorksheetStore();

  beforeEach(async () => {
    const { app: nextApp, savedWorksheetStore: nextSavedWorksheetStore } =
      createTestApp();
    app = nextApp;
    savedWorksheetStore = nextSavedWorksheetStore;
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

  it('blocks saved worksheet write APIs while anonymous', async () => {
    const response = await client.request(
      '/api/savedWorksheets/from-anonymous',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'FA26 Worksheet',
          term: 'FA26',
          courses: [],
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(savedWorksheetStore.recordsByUserId.size).toBe(0);
  });

  it('blocks Main Worksheet bootstrap while anonymous', async () => {
    const response = await client.request('/api/savedWorksheets/ensure-main', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(savedWorksheetStore.recordsByUserId.size).toBe(0);
  });

  it('blocks blank Saved Worksheet creation while anonymous', async () => {
    const response = await client.request('/api/savedWorksheets/create-blank', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(savedWorksheetStore.recordsByUserId.size).toBe(0);
  });

  it('blocks Saved Worksheet management while anonymous', async () => {
    const renameResponse = await client.request(
      '/api/savedWorksheets/1/rename',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Renamed Plan' }),
      },
    );
    const deleteResponse = await client.request(
      '/api/savedWorksheets/1/delete',
      {
        method: 'POST',
      },
    );
    const sectionsResponse = await client.request(
      '/api/savedWorksheets/1/sections',
      {
        method: 'POST',
        body: JSON.stringify({ sections: [] }),
      },
    );

    expect(renameResponse.status).toBe(401);
    expect(await renameResponse.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(deleteResponse.status).toBe(401);
    expect(await deleteResponse.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(sectionsResponse.status).toBe(401);
    expect(await sectionsResponse.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(savedWorksheetStore.recordsByUserId.size).toBe(0);
  });

  it('blocks saved worksheet restore APIs while anonymous', async () => {
    const listResponse = await client.request('/api/savedWorksheets');
    const detailResponse = await client.request('/api/savedWorksheets/1');

    expect(listResponse.status).toBe(401);
    expect(await listResponse.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(detailResponse.status).toBe(401);
    expect(await detailResponse.json()).toEqual({ error: 'USER_NOT_FOUND' });
  });

  it('rejects invalid anonymous worksheet save bodies', async () => {
    await signIn(client, 'student@ucsd.edu');

    const response = await client.request(
      '/api/savedWorksheets/from-anonymous',
      {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          term: 'FA26',
          courses: [{ sectionId: 'FA26-123', color: '#55aaff' }],
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_REQUEST' });
    expect(savedWorksheetStore.recordsByUserId.size).toBe(0);
  });

  it('does not save the anonymous worksheet automatically on sign-in', async () => {
    await signIn(client, 'student@ucsd.edu');

    const listResponse = await client.request('/api/savedWorksheets');

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({ data: [] });
    expect(savedWorksheetStore.recordsByUserId.get(1) ?? []).toHaveLength(0);
  });

  it('saves the signed-in user anonymous worksheet with deduped section ids', async () => {
    await signIn(client, 'student@ucsd.edu');

    const response = await client.request(
      '/api/savedWorksheets/from-anonymous',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'FA26 Worksheet',
          term: 'FA26',
          courses: [
            { sectionId: 'FA26-123', color: '#55aaff', hidden: false },
            { sectionId: 'FA26-123', color: '#000000', hidden: true },
            { sectionId: 'FA26-456', color: '#ee6677', hidden: true },
          ],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 1,
      name: 'FA26 Worksheet',
      term: 'FA26',
      createdAt: 1_000_000,
      updatedAt: 1_000_000,
      private: true,
      isMain: false,
      sourceSectionCount: 3,
      savedSectionCount: 2,
      sections: [
        { sectionId: 'FA26-123', color: '#55aaff', hidden: false },
        { sectionId: 'FA26-456', color: '#ee6677', hidden: true },
      ],
    });
    expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(1);
  });

  it('replaces Saved Worksheet sections for the current app user', async () => {
    await signIn(client, 'student@ucsd.edu');
    const createResponse = await client.request(
      '/api/savedWorksheets/from-anonymous',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Initial Plan',
          term: 'S126',
          courses: [{ sectionId: 'S126-111', color: '#55aaff', hidden: false }],
        }),
      },
    );
    const created = (await createResponse.json()) as { id: number };

    const response = await client.request(
      `/api/savedWorksheets/${created.id}/sections`,
      {
        method: 'POST',
        body: JSON.stringify({
          sections: [
            { sectionId: 'S126-222', color: '#ee6677', hidden: true },
            { sectionId: 'S126-222', color: '#000000', hidden: false },
            { sectionId: 'S126-333', color: '#55aaff', hidden: false },
          ],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: created.id,
      name: 'Initial Plan',
      term: 'S126',
      createdAt: 1_000_000,
      updatedAt: 1_000_000,
      private: true,
      isMain: false,
      sourceSectionCount: 3,
      savedSectionCount: 2,
      sections: [
        { sectionId: 'S126-222', color: '#ee6677', hidden: true },
        { sectionId: 'S126-333', color: '#55aaff', hidden: false },
      ],
    });

    const detailResponse = await client.request(
      `/api/savedWorksheets/${created.id}`,
    );
    expect(await detailResponse.json()).toMatchObject({
      id: created.id,
      sections: [
        { sectionId: 'S126-222', color: '#ee6677', hidden: true },
        { sectionId: 'S126-333', color: '#55aaff', hidden: false },
      ],
    });
  });

  it('creates a blank Saved Worksheet without copying existing worksheet sections', async () => {
    await signIn(client, 'student@ucsd.edu');

    await client.request('/api/savedWorksheets/from-anonymous', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Loaded Local Worksheet',
        term: 'S126',
        courses: [
          { sectionId: 'S126-123', color: '#55aaff', hidden: false },
          { sectionId: 'S126-456', color: '#ee6677', hidden: true },
        ],
      }),
    });

    const response = await client.request('/api/savedWorksheets/create-blank', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 2,
      name: 'New Worksheet',
      term: 'S126',
      createdAt: 1_000_000,
      updatedAt: 1_000_000,
      private: true,
      isMain: false,
      sourceSectionCount: 0,
      savedSectionCount: 0,
      sections: [],
    });
    expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(2);
  });

  it('filters Saved Worksheet list reads by term and app user id', async () => {
    await signIn(client, 'first@ucsd.edu');
    await client.request('/api/savedWorksheets/ensure-main', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });
    await client.request('/api/savedWorksheets/create-blank', {
      method: 'POST',
      body: JSON.stringify({ name: 'Summer Plan', term: 'S126' }),
    });
    await client.request('/api/savedWorksheets/create-blank', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fall Plan', term: 'FA26' }),
    });

    const firstList = await client.request('/api/savedWorksheets?term=S126');

    expect(firstList.status).toBe(200);
    expect(await firstList.json()).toEqual({
      data: [
        expect.objectContaining({
          name: 'Summer Plan',
          term: 'S126',
          sectionCount: 0,
        }),
        expect.objectContaining({
          name: 'Main Worksheet',
          term: 'S126',
          sectionCount: 0,
        }),
      ],
    });

    const secondClient = new TestClient();
    const secondServer = await secondClient.start(app);
    try {
      await signIn(secondClient, 'second@ucsd.edu');

      const secondList = await secondClient.request(
        '/api/savedWorksheets?term=S126',
      );

      expect(secondList.status).toBe(200);
      expect(await secondList.json()).toEqual({ data: [] });
    } finally {
      await new Promise<void>((resolve, reject) => {
        secondServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('ensures a signed-in user has a term-scoped Main Worksheet', async () => {
    await signIn(client, 'student@ucsd.edu');

    const response = await client.request('/api/savedWorksheets/ensure-main', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 1,
      name: 'Main Worksheet',
      term: 'S126',
      createdAt: 1_000_000,
      updatedAt: 1_000_000,
      private: true,
      isMain: true,
      sourceSectionCount: 0,
      savedSectionCount: 0,
      sections: [],
    });
    expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(1);
  });

  it('reuses the existing term Main Worksheet on repeated signed-in loads', async () => {
    await signIn(client, 'student@ucsd.edu');

    const firstResponse = await client.request(
      '/api/savedWorksheets/ensure-main',
      {
        method: 'POST',
        body: JSON.stringify({ term: 'S126' }),
      },
    );
    const secondResponse = await client.request(
      '/api/savedWorksheets/ensure-main',
      {
        method: 'POST',
        body: JSON.stringify({ term: 'S126' }),
      },
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual(await firstResponse.json());
    expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(1);
  });

  it('does not leak Main Worksheets across app users', async () => {
    await signIn(client, 'first@ucsd.edu');
    const firstResponse = await client.request(
      '/api/savedWorksheets/ensure-main',
      {
        method: 'POST',
        body: JSON.stringify({ term: 'S126' }),
      },
    );
    const firstWorksheet = (await firstResponse.json()) as { id: number };

    const secondClient = new TestClient();
    const secondServer = await secondClient.start(app);
    try {
      await signIn(secondClient, 'second@ucsd.edu');

      const secondResponse = await secondClient.request(
        '/api/savedWorksheets/ensure-main',
        {
          method: 'POST',
          body: JSON.stringify({ term: 'S126' }),
        },
      );
      const secondWorksheet = (await secondResponse.json()) as { id: number };

      expect(secondResponse.status).toBe(200);
      expect(secondWorksheet.id).not.toBe(firstWorksheet.id);
      expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(1);
      expect(savedWorksheetStore.recordsByUserId.get(2)).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        secondServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('isolates saved worksheet list and detail reads by app user id', async () => {
    await signIn(client, 'first@ucsd.edu');
    const createResponse = await client.request(
      '/api/savedWorksheets/from-anonymous',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Private worksheet',
          term: 'FA26',
          courses: [{ sectionId: 'FA26-123', color: '#55aaff', hidden: false }],
        }),
      },
    );
    const created = (await createResponse.json()) as { id: number };

    const secondClient = new TestClient();
    const secondServer = await secondClient.start(app);
    try {
      await signIn(secondClient, 'second@ucsd.edu');

      const secondList = await secondClient.request('/api/savedWorksheets');
      expect(secondList.status).toBe(200);
      expect(await secondList.json()).toEqual({ data: [] });

      const secondDetail = await secondClient.request(
        `/api/savedWorksheets/${created.id}`,
      );
      expect(secondDetail.status).toBe(404);
      expect(await secondDetail.json()).toEqual({
        error: 'SAVED_WORKSHEET_NOT_FOUND',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        secondServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    const firstDetail = await client.request(
      `/api/savedWorksheets/${created.id}`,
    );
    expect(firstDetail.status).toBe(200);
    expect(await firstDetail.json()).toMatchObject({
      id: created.id,
      name: 'Private worksheet',
      term: 'FA26',
      sections: [{ sectionId: 'FA26-123', color: '#55aaff', hidden: false }],
    });
  });

  it('renames an extra Saved Worksheet for the current app user', async () => {
    await signIn(client, 'student@ucsd.edu');
    await client.request('/api/savedWorksheets/ensure-main', {
      method: 'POST',
      body: JSON.stringify({ term: 'S126' }),
    });
    const createResponse = await client.request(
      '/api/savedWorksheets/create-blank',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'First Draft', term: 'S126' }),
      },
    );
    const created = (await createResponse.json()) as { id: number };

    const renameResponse = await client.request(
      `/api/savedWorksheets/${created.id}/rename`,
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Lab Plan' }),
      },
    );

    expect(renameResponse.status).toBe(200);
    expect(await renameResponse.json()).toMatchObject({
      id: created.id,
      name: 'Lab Plan',
      term: 'S126',
      isMain: false,
      sections: [],
    });

    const detailResponse = await client.request(
      `/api/savedWorksheets/${created.id}`,
    );
    expect(await detailResponse.json()).toMatchObject({
      id: created.id,
      name: 'Lab Plan',
    });
  });

  it('deletes an extra Saved Worksheet and returns Main Worksheet as fallback', async () => {
    await signIn(client, 'student@ucsd.edu');
    const mainResponse = await client.request(
      '/api/savedWorksheets/ensure-main',
      {
        method: 'POST',
        body: JSON.stringify({ term: 'S126' }),
      },
    );
    const main = (await mainResponse.json()) as { id: number };
    const createResponse = await client.request(
      '/api/savedWorksheets/create-blank',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Extra Plan', term: 'S126' }),
      },
    );
    const created = (await createResponse.json()) as { id: number };

    const deleteResponse = await client.request(
      `/api/savedWorksheets/${created.id}/delete`,
      {
        method: 'POST',
      },
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toMatchObject({
      deletedId: created.id,
      term: 'S126',
      fallbackWorksheet: {
        id: main.id,
        name: 'Main Worksheet',
        term: 'S126',
        isMain: true,
      },
    });

    const listResponse = await client.request('/api/savedWorksheets?term=S126');
    expect(await listResponse.json()).toEqual({
      data: [
        expect.objectContaining({
          id: main.id,
          name: 'Main Worksheet',
          isMain: true,
        }),
      ],
    });

    const deletedDetail = await client.request(
      `/api/savedWorksheets/${created.id}`,
    );
    expect(deletedDetail.status).toBe(404);
  });

  it('prevents deleting the only Saved Worksheet in a term', async () => {
    await signIn(client, 'student@ucsd.edu');
    const mainResponse = await client.request(
      '/api/savedWorksheets/ensure-main',
      {
        method: 'POST',
        body: JSON.stringify({ term: 'S126' }),
      },
    );
    const main = (await mainResponse.json()) as { id: number };

    const deleteResponse = await client.request(
      `/api/savedWorksheets/${main.id}/delete`,
      {
        method: 'POST',
      },
    );

    expect(deleteResponse.status).toBe(409);
    expect(await deleteResponse.json()).toEqual({
      error: 'ONLY_SAVED_WORKSHEET_CANNOT_BE_DELETED',
    });
    expect(savedWorksheetStore.recordsByUserId.get(1)).toHaveLength(1);
  });

  it('does not expose cross-user rename or delete attempts', async () => {
    await signIn(client, 'first@ucsd.edu');
    const createResponse = await client.request(
      '/api/savedWorksheets/create-blank',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Private Plan', term: 'S126' }),
      },
    );
    const created = (await createResponse.json()) as { id: number };

    const secondClient = new TestClient();
    const secondServer = await secondClient.start(app);
    try {
      await signIn(secondClient, 'second@ucsd.edu');

      const renameResponse = await secondClient.request(
        `/api/savedWorksheets/${created.id}/rename`,
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Stolen Plan' }),
        },
      );
      const deleteResponse = await secondClient.request(
        `/api/savedWorksheets/${created.id}/delete`,
        {
          method: 'POST',
        },
      );
      const sectionsResponse = await secondClient.request(
        `/api/savedWorksheets/${created.id}/sections`,
        {
          method: 'POST',
          body: JSON.stringify({ sections: [] }),
        },
      );

      expect(renameResponse.status).toBe(404);
      expect(await renameResponse.json()).toEqual({
        error: 'SAVED_WORKSHEET_NOT_FOUND',
      });
      expect(deleteResponse.status).toBe(404);
      expect(await deleteResponse.json()).toEqual({
        error: 'SAVED_WORKSHEET_NOT_FOUND',
      });
      expect(sectionsResponse.status).toBe(404);
      expect(await sectionsResponse.json()).toEqual({
        error: 'SAVED_WORKSHEET_NOT_FOUND',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        secondServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    const firstDetail = await client.request(
      `/api/savedWorksheets/${created.id}`,
    );
    expect(firstDetail.status).toBe(200);
    expect(await firstDetail.json()).toMatchObject({
      id: created.id,
      name: 'Private Plan',
    });
  });
});
