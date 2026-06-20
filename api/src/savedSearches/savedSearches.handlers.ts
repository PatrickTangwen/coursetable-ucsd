import type express from 'express';
import z from 'zod';

import type { SavedSearchStore } from './savedSearches.store.js';
import { getAppSessionUser } from '../auth/ucsdAuth.session.js';

const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(64),
  queryString: z.string().max(2048),
});

const DeleteSavedSearchSchema = z.object({
  id: z.number().int().positive(),
});

export function createSavedSearchHandlers(store: SavedSearchStore) {
  const getSavedSearches = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const searches = await store.listByUserId(user.user_id);

    res.json({ data: searches });
  };

  const createSavedSearch = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const bodyParseRes = CreateSavedSearchSchema.safeParse(req.body);
    if (!bodyParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const { name, queryString } = bodyParseRes.data;

    const created = await store.createForUserId(
      user.user_id,
      name,
      queryString,
      Date.now(),
    );

    if (!created) {
      res.status(400).json({ error: 'DUPLICATE_NAME' });
      return;
    }
    res.json(created);
  };

  const deleteSavedSearch = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const bodyParseRes = DeleteSavedSearchSchema.safeParse(req.body);
    if (!bodyParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const { id } = bodyParseRes.data;

    const deleted = await store.deleteForUserId(user.user_id, id);

    if (!deleted) {
      res.status(404).json({ error: 'SEARCH_NOT_FOUND' });
      return;
    }
    res.sendStatus(200);
  };

  return {
    getSavedSearches,
    createSavedSearch,
    deleteSavedSearch,
  };
}
