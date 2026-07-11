import type express from 'express';
import asyncHandler from 'express-async-handler';

import { createSavedSearchHandlers } from './savedSearches.handlers.js';
import type { SavedSearchStore } from './savedSearches.store.js';
import type { AppSession } from '../auth/appSession.js';
import { createAuthAppUser } from '../auth/ucsdAuth.session.js';

export function registerSavedSearchRoutes(
  app: express.IRouter,
  store: SavedSearchStore,
  session: AppSession,
): void {
  const { getSavedSearches, createSavedSearch, deleteSavedSearch } =
    createSavedSearchHandlers(store, session.getUser);
  const authAppUser = createAuthAppUser(session);

  // Each route gets auth explicitly; app.use with path can mismatch GET.
  app.get('/api/savedSearches', authAppUser, asyncHandler(getSavedSearches));
  app.post(
    '/api/savedSearches/create',
    authAppUser,
    asyncHandler(createSavedSearch),
  );
  app.post(
    '/api/savedSearches/delete',
    authAppUser,
    asyncHandler(deleteSavedSearch),
  );
}
