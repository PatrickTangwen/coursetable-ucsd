import type express from 'express';
import asyncHandler from 'express-async-handler';

import { createSavedWorksheetHandlers } from './savedWorksheets.handlers.js';
import type { SavedWorksheetStore } from './savedWorksheets.store.js';
import { authAppUser } from '../auth/ucsdAuth.session.js';

export function registerSavedWorksheetRoutes(
  app: express.Express,
  store: SavedWorksheetStore,
  now = () => Date.now(),
): void {
  const {
    listSavedWorksheets,
    getSavedWorksheet,
    saveAnonymousWorksheet,
    ensureMainWorksheet,
    createBlankWorksheet,
    renameSavedWorksheet,
    deleteSavedWorksheet,
    updateSavedWorksheetSections,
  } = createSavedWorksheetHandlers(store, now);

  app.get(
    '/api/savedWorksheets',
    authAppUser,
    asyncHandler(listSavedWorksheets),
  );
  app.post(
    '/api/savedWorksheets/ensure-main',
    authAppUser,
    asyncHandler(ensureMainWorksheet),
  );
  app.post(
    '/api/savedWorksheets/create-blank',
    authAppUser,
    asyncHandler(createBlankWorksheet),
  );
  app.post(
    '/api/savedWorksheets/:id/rename',
    authAppUser,
    asyncHandler(renameSavedWorksheet),
  );
  app.post(
    '/api/savedWorksheets/:id/delete',
    authAppUser,
    asyncHandler(deleteSavedWorksheet),
  );
  app.post(
    '/api/savedWorksheets/:id/sections',
    authAppUser,
    asyncHandler(updateSavedWorksheetSections),
  );
  app.get(
    '/api/savedWorksheets/:id',
    authAppUser,
    asyncHandler(getSavedWorksheet),
  );
  app.post(
    '/api/savedWorksheets/from-anonymous',
    authAppUser,
    asyncHandler(saveAnonymousWorksheet),
  );
}

export default (app: express.Express, store: SavedWorksheetStore): void => {
  registerSavedWorksheetRoutes(app, store);
};
