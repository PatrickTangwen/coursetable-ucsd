import type express from 'express';
import asyncHandler from 'express-async-handler';

import { createSavedWorksheetHandlers } from './savedWorksheets.handlers.js';
import type { SavedWorksheetStore } from './savedWorksheets.store.js';
import type { AppSession } from '../auth/appSession.js';
import { createAuthAppUser } from '../auth/ucsdAuth.session.js';

interface SavedWorksheetRoutesOptions {
  now?: () => number;
  session: AppSession;
}

export function registerSavedWorksheetRoutes(
  app: express.IRouter,
  store: SavedWorksheetStore,
  { now = () => Date.now(), session }: SavedWorksheetRoutesOptions,
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
  } = createSavedWorksheetHandlers(store, now, session.getUser);
  const authAppUser = createAuthAppUser(session);

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
