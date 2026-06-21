import type express from 'express';
import z from 'zod';

import type {
  SavedWorksheetRecord,
  SavedWorksheetStore,
} from './savedWorksheets.store.js';
import { getAppSessionUser } from '../auth/ucsdAuth.session.js';

const SavedWorksheetCourseSchema = z.object({
  sectionId: z.string().trim().min(1).max(128),
  color: z.string().trim().min(1).max(32),
  hidden: z.boolean(),
});

const SaveAnonymousWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(64),
  term: z.string().trim().min(1).max(32),
  courses: z.array(SavedWorksheetCourseSchema).max(200),
});

function savedWorksheetResponse(
  worksheet: SavedWorksheetRecord,
  sourceSectionCount = worksheet.sections.length,
) {
  return {
    id: worksheet.id,
    name: worksheet.name,
    term: worksheet.term,
    createdAt: worksheet.createdAt,
    updatedAt: worksheet.updatedAt,
    private: worksheet.private,
    sourceSectionCount,
    savedSectionCount: worksheet.sections.length,
    sections: worksheet.sections,
  };
}

function parsePositiveInteger(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function createSavedWorksheetHandlers(
  store: SavedWorksheetStore,
  now = () => Date.now(),
) {
  const listSavedWorksheets = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const worksheets = await store.listByUserId(user.user_id);

    res.json({ data: worksheets });
  };

  const getSavedWorksheet = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;
    const id = parsePositiveInteger(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const worksheet = await store.getForUserId(user.user_id, id);
    if (!worksheet) {
      res.status(404).json({ error: 'SAVED_WORKSHEET_NOT_FOUND' });
      return;
    }

    res.json(savedWorksheetResponse(worksheet));
  };

  const saveAnonymousWorksheet = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const bodyParseRes = SaveAnonymousWorksheetSchema.safeParse(req.body);
    if (!bodyParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const body = bodyParseRes.data;
    const created = await store.createForUserId(
      user.user_id,
      {
        name: body.name,
        term: body.term,
        sections: body.courses,
      },
      now(),
    );

    res.json(savedWorksheetResponse(created, body.courses.length));
  };

  return {
    listSavedWorksheets,
    getSavedWorksheet,
    saveAnonymousWorksheet,
  };
}
