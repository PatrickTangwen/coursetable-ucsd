import express from 'express';

import type { AppSession } from '../auth/appSession.js';
import {
  registerAuthCheckRoute,
  registerUcsdAuthRoutes,
  type UcsdAuthRoutesOptions,
} from '../auth/ucsdAuth.routes.js';
import { registerPublishedSnapshotRoutes } from '../catalog/publishedSnapshot.routes.js';
import type { PublishedSnapshotStore } from '../catalog/publishedSnapshot.store.js';
import { registerSavedSearchRoutes } from '../savedSearches/savedSearches.routes.js';
import type { SavedSearchStore } from '../savedSearches/savedSearches.store.js';
import { registerSavedWorksheetRoutes } from '../savedWorksheets/savedWorksheets.routes.js';
import type { SavedWorksheetStore } from '../savedWorksheets/savedWorksheets.store.js';

type CoreAuthDependencies = Omit<
  UcsdAuthRoutesOptions,
  'session' | 'requestLimiter' | 'verificationAttemptLimiter'
> &
  Required<
    Pick<UcsdAuthRoutesOptions, 'requestLimiter' | 'verificationAttemptLimiter'>
  >;

export interface CoreAppBackendDependencies {
  auth: CoreAuthDependencies;
  publishedSnapshots: PublishedSnapshotStore;
  savedSearches: SavedSearchStore;
  savedWorksheets: SavedWorksheetStore;
  session: AppSession;
}

export function createCoreAppBackend({
  auth,
  publishedSnapshots,
  savedSearches,
  savedWorksheets,
  session,
}: CoreAppBackendDependencies) {
  assertCoreDependencies({
    auth,
    publishedSnapshots,
    savedSearches,
    savedWorksheets,
    session,
  });
  const router = express.Router();
  registerPublishedSnapshotRoutes(router, publishedSnapshots);
  registerAuthCheckRoute(router, session);
  registerUcsdAuthRoutes(router, { ...auth, session });
  registerSavedSearchRoutes(router, savedSearches, session);
  registerSavedWorksheetRoutes(router, savedWorksheets, { session });
  router.get('/api/ping', (_req, res) => res.json('pong'));
  return router;
}

function assertCoreDependencies(dependencies: CoreAppBackendDependencies) {
  const { auth } = dependencies as { auth?: CoreAuthDependencies };
  if (!auth) throw new Error('Core App Backend dependency missing: auth');
  assertMethods('session', dependencies.session, [
    'destroy',
    'establish',
    'getUser',
  ]);
  assertMethods('publishedSnapshots', dependencies.publishedSnapshots, [
    'openMetadata',
    'openSnapshot',
  ]);
  assertMethods('savedSearches', dependencies.savedSearches, [
    'listByUserId',
    'createForUserId',
    'deleteForUserId',
  ]);
  assertMethods('savedWorksheets', dependencies.savedWorksheets, [
    'listByUserId',
    'getForUserId',
    'createForUserId',
    'ensureMainForUserId',
    'renameForUserId',
    'deleteForUserId',
    'replaceSectionsForUserId',
  ]);
  assertMethods('auth.store', auth.store, [
    'reserveVerification',
    'markVerificationSent',
    'markVerificationFailed',
    'consumeVerification',
    'findOrCreateUser',
  ]);
  assertMethods('auth.emailSender', auth.emailSender, [
    'sendVerificationEmail',
  ]);
  assertMethods('auth.requestLimiter', auth.requestLimiter, [
    'admitSource',
    'consumeSend',
  ]);
  assertMethods(
    'auth.verificationAttemptLimiter',
    auth.verificationAttemptLimiter,
    ['attempt', 'resetEmail'],
  );
}

function assertMethods(name: string, dependency: unknown, methods: string[]) {
  if (!dependency || typeof dependency !== 'object')
    throw new Error(`Core App Backend dependency missing: ${name}`);
  for (const method of methods) {
    if (
      typeof (dependency as { [key: string]: unknown })[method] !== 'function'
    )
      throw new Error(`Core App Backend dependency missing: ${name}.${method}`);
  }
}
