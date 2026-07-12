import http from 'node:http';

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { afterEach, describe, it } from 'vitest';

import {
  createHostedContractAuthOptions,
  exerciseHostedLoginContract,
  HostedLoginCookieClient,
} from './hostedLogin.contract.js';
import { expressAppSession } from './ucsdAuth.session.js';
import {
  createUnlimitedVerificationAttemptLimiter,
  createUnlimitedVerificationRequestLimiter,
} from './verificationRequest.limiter.js';
import { createMemoryPublishedSnapshotStore } from '../catalog/publishedSnapshot.memory.js';
import { createCoreAppBackend } from '../core/coreAppBackend.js';
import { createMemorySavedSearchStore } from '../savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../savedWorksheets/savedWorksheets.memory.js';

async function startNodeComposition() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(
    session({
      name: 'sungrid_session',
      secret: 'node-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: true,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.authenticate('session'));
  app.use(
    createCoreAppBackend({
      auth: {
        ...createHostedContractAuthOptions(),
        requestLimiter: createUnlimitedVerificationRequestLimiter(),
        verificationAttemptLimiter: createUnlimitedVerificationAttemptLimiter(),
      },
      publishedSnapshots: createMemoryPublishedSnapshotStore({
        metadata: '{}',
        snapshots: {},
      }),
      savedSearches: createMemorySavedSearchStore(),
      savedWorksheets: createMemorySavedWorksheetStore(),
      session: expressAppSession,
    }),
  );
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Node contract server did not bind a TCP port');
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    client: new HostedLoginCookieClient(
      (request) => fetch(request),
      origin,
      true,
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

describe('hosted login external HTTP contract on Node', () => {
  const cleanup: (() => Promise<void>)[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((close) => close()));
  });

  it('runs unchanged against the Node composition', async () => {
    const server = await startNodeComposition();
    cleanup.push(server.close);
    await exerciseHostedLoginContract(server.client);
  });
});
