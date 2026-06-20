import type express from 'express';
import asyncHandler from 'express-async-handler';

import { createSavedSearchHandlers } from './savedSearches.handlers.js';
import type { SavedSearchStore } from './savedSearches.store.js';
import { authAppUser } from '../auth/ucsdAuth.session.js';

export function registerSavedSearchRoutes(
  app: express.Express,
  store: SavedSearchStore,
): void {
  const { getSavedSearches, createSavedSearch, deleteSavedSearch } =
    createSavedSearchHandlers(store);

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

export default (app: express.Express, store: SavedSearchStore): void => {
  registerSavedSearchRoutes(app, store);
};
