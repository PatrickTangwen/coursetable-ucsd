import type express from 'express';
import z from 'zod';

import {
  BLANK_SAVED_WORKSHEET_NAME,
  type SavedWorksheetRecord,
  type SavedWorksheetStore,
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

const EnsureMainWorksheetSchema = z.object({
  term: z.string().trim().min(1).max(32),
});

const CreateBlankWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  term: z.string().trim().min(1).max(32),
});

const ListSavedWorksheetsQuerySchema = z.object({
  term: z.string().trim().min(1).max(32).optional(),
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
    isMain: worksheet.isMain,
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

    const queryParseRes = ListSavedWorksheetsQuerySchema.safeParse(req.query);
    if (!queryParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const worksheets = await store.listByUserId(user.user_id);
    const data = queryParseRes.data.term
      ? worksheets.filter(
          (worksheet) => worksheet.term === queryParseRes.data.term,
        )
      : worksheets;

    res.json({ data });
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

  const ensureMainWorksheet = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const bodyParseRes = EnsureMainWorksheetSchema.safeParse(req.body);
    if (!bodyParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const worksheet = await store.ensureMainForUserId(
      user.user_id,
      bodyParseRes.data.term,
      now(),
    );

    res.json(savedWorksheetResponse(worksheet));
  };

  const createBlankWorksheet = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const user = getAppSessionUser(req)!;

    const bodyParseRes = CreateBlankWorksheetSchema.safeParse(req.body);
    if (!bodyParseRes.success) {
      res.status(400).json({ error: 'INVALID_REQUEST' });
      return;
    }

    const body = bodyParseRes.data;
    const worksheet = await store.createForUserId(
      user.user_id,
      {
        name: body.name ?? BLANK_SAVED_WORKSHEET_NAME,
        term: body.term,
        sections: [],
      },
      now(),
    );

    res.json(savedWorksheetResponse(worksheet, 0));
  };

  return {
    listSavedWorksheets,
    getSavedWorksheet,
    saveAnonymousWorksheet,
    ensureMainWorksheet,
    createBlankWorksheet,
  };
}
