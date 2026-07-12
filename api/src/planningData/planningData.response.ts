import z from 'zod';

import { matchPlanningOperation } from './planningData.routing.js';
import type { AppUserIdentity } from '../auth/ucsdIdentity.js';
import type { SavedSearchStore } from '../savedSearches/savedSearches.store.js';
import {
  BLANK_SAVED_WORKSHEET_NAME,
  type SavedWorksheetRecord,
  type SavedWorksheetStore,
} from '../savedWorksheets/savedWorksheets.store.js';

const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(64),
  queryString: z.string().max(2048),
});
const DeleteSavedSearchSchema = z.object({
  id: z.number().int().positive(),
});
const SavedWorksheetSectionSchema = z.object({
  sectionId: z.string().trim().min(1).max(128),
  color: z.string().trim().min(1).max(32),
  hidden: z.boolean(),
});
const SaveAnonymousWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(64),
  term: z.string().trim().min(1).max(32),
  courses: z.array(SavedWorksheetSectionSchema).max(200),
});
const EnsureMainWorksheetSchema = z.object({
  term: z.string().trim().min(1).max(32),
});
const CreateBlankWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  term: z.string().trim().min(1).max(32),
});
const RenameSavedWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
const UpdateSavedWorksheetSectionsSchema = z.object({
  sections: z.array(SavedWorksheetSectionSchema).max(200),
});
const ListSavedWorksheetsQuerySchema = z.object({
  term: z.string().trim().min(1).max(32).optional(),
});

export interface PlanningDataHttpRequest {
  body?: unknown;
  context: unknown;
  method: string;
  pathname: string;
  query?: unknown;
}

export interface PlanningDataHttpOptions {
  savedSearches: SavedSearchStore;
  savedWorksheets: SavedWorksheetStore;
  session: {
    getUser: (context: unknown) => Promise<AppUserIdentity | null>;
  };
  now?: () => number;
}

export async function createPlanningDataResponse(
  request: PlanningDataHttpRequest,
  {
    savedSearches,
    savedWorksheets,
    session,
    now = Date.now,
  }: PlanningDataHttpOptions,
): Promise<Response | null> {
  const operation = matchPlanningOperation(request.method, request.pathname);
  if (!operation) return null;

  const headers = new Headers({ 'cache-control': 'no-store' });
  const user = await session.getUser(request.context);
  if (!user) return jsonResponse({ error: 'USER_NOT_FOUND' }, 401, headers);

  if (operation.name === 'list-searches') {
    return jsonResponse(
      { data: await savedSearches.listByUserId(user.user_id) },
      200,
      headers,
    );
  }

  if (operation.name === 'create-search') {
    const createSearchBody = CreateSavedSearchSchema.safeParse(request.body);
    if (!createSearchBody.success) return invalidRequest(headers);
    const created = await savedSearches.createForUserId(
      user.user_id,
      createSearchBody.data.name,
      createSearchBody.data.queryString,
      now(),
    );
    return created
      ? jsonResponse(created, 200, headers)
      : jsonResponse({ error: 'DUPLICATE_NAME' }, 400, headers);
  }

  if (operation.name === 'delete-search') {
    const deleteSearchBody = DeleteSavedSearchSchema.safeParse(request.body);
    if (!deleteSearchBody.success) return invalidRequest(headers);
    const deleted = await savedSearches.deleteForUserId(
      user.user_id,
      deleteSearchBody.data.id,
    );
    return deleted
      ? new Response('OK', { status: 200, headers })
      : jsonResponse({ error: 'SEARCH_NOT_FOUND' }, 404, headers);
  }

  if (operation.name === 'list-worksheets') {
    const listQuery = ListSavedWorksheetsQuerySchema.safeParse(
      request.query ?? {},
    );
    if (!listQuery.success) return invalidRequest(headers);
    const worksheets = await savedWorksheets.listByUserId(user.user_id);
    const data = listQuery.data.term
      ? worksheets.filter((worksheet) => worksheet.term === listQuery.data.term)
      : worksheets;
    return jsonResponse({ data }, 200, headers);
  }

  if (operation.name === 'get-worksheet') {
    const detailId = parsePositiveInteger(operation.id);
    if (!detailId) return invalidRequest(headers);
    const worksheet = await savedWorksheets.getForUserId(
      user.user_id,
      detailId,
    );
    return worksheet
      ? jsonResponse(savedWorksheetResponse(worksheet), 200, headers)
      : worksheetNotFound(headers);
  }

  if (operation.name === 'save-anonymous-worksheet') {
    const anonymousBody = SaveAnonymousWorksheetSchema.safeParse(request.body);
    if (!anonymousBody.success) return invalidRequest(headers);
    const created = await savedWorksheets.createForUserId(
      user.user_id,
      {
        name: anonymousBody.data.name,
        term: anonymousBody.data.term,
        sections: anonymousBody.data.courses,
      },
      now(),
    );
    return jsonResponse(
      savedWorksheetResponse(created, anonymousBody.data.courses.length),
      200,
      headers,
    );
  }

  if (operation.name === 'ensure-main-worksheet') {
    const mainBody = EnsureMainWorksheetSchema.safeParse(request.body);
    if (!mainBody.success) return invalidRequest(headers);
    const worksheet = await savedWorksheets.ensureMainForUserId(
      user.user_id,
      mainBody.data.term,
      now(),
    );
    return jsonResponse(savedWorksheetResponse(worksheet), 200, headers);
  }

  if (operation.name === 'create-blank-worksheet') {
    const blankBody = CreateBlankWorksheetSchema.safeParse(request.body);
    if (!blankBody.success) return invalidRequest(headers);
    const worksheet = await savedWorksheets.createForUserId(
      user.user_id,
      {
        name: blankBody.data.name ?? BLANK_SAVED_WORKSHEET_NAME,
        term: blankBody.data.term,
        sections: [],
      },
      now(),
    );
    return jsonResponse(savedWorksheetResponse(worksheet, 0), 200, headers);
  }

  const mutationId = parsePositiveInteger(operation.id);
  if (!mutationId) return invalidRequest(headers);

  if (operation.name === 'rename-worksheet') {
    const renameBody = RenameSavedWorksheetSchema.safeParse(request.body);
    if (!renameBody.success) return invalidRequest(headers);
    const renameResult = await savedWorksheets.renameForUserId(
      user.user_id,
      mutationId,
      renameBody.data.name,
      now(),
    );
    if (renameResult.status === 'not-found') return worksheetNotFound(headers);
    if (renameResult.status === 'cannot-rename-main') {
      return jsonResponse(
        { error: 'MAIN_SAVED_WORKSHEET_CANNOT_BE_RENAMED' },
        409,
        headers,
      );
    }
    return jsonResponse(
      savedWorksheetResponse(renameResult.worksheet),
      200,
      headers,
    );
  }

  if (operation.name === 'delete-worksheet') {
    const deleteResult = await savedWorksheets.deleteForUserId(
      user.user_id,
      mutationId,
    );
    if (deleteResult.status === 'not-found') return worksheetNotFound(headers);
    if (deleteResult.status === 'cannot-delete-only') {
      return jsonResponse(
        { error: 'ONLY_SAVED_WORKSHEET_CANNOT_BE_DELETED' },
        409,
        headers,
      );
    }
    if (deleteResult.status === 'cannot-delete-main') {
      return jsonResponse(
        { error: 'MAIN_SAVED_WORKSHEET_CANNOT_BE_DELETED' },
        409,
        headers,
      );
    }
    return jsonResponse(
      {
        deletedId: deleteResult.deletedId,
        term: deleteResult.term,
        fallbackWorksheet: deleteResult.fallbackWorksheet
          ? savedWorksheetResponse(deleteResult.fallbackWorksheet)
          : null,
      },
      200,
      headers,
    );
  }

  const sectionsBody = UpdateSavedWorksheetSectionsSchema.safeParse(
    request.body,
  );
  if (!sectionsBody.success) return invalidRequest(headers);
  const sectionsResult = await savedWorksheets.replaceSectionsForUserId(
    user.user_id,
    mutationId,
    sectionsBody.data.sections,
    now(),
  );
  return sectionsResult.status === 'not-found'
    ? worksheetNotFound(headers)
    : jsonResponse(
        savedWorksheetResponse(
          sectionsResult.worksheet,
          sectionsBody.data.sections.length,
        ),
        200,
        headers,
      );
}

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

function parsePositiveInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function invalidRequest(headers: Headers) {
  return jsonResponse({ error: 'INVALID_REQUEST' }, 400, headers);
}

function worksheetNotFound(headers: Headers) {
  return jsonResponse({ error: 'SAVED_WORKSHEET_NOT_FOUND' }, 404, headers);
}

function jsonResponse(body: unknown, status: number, headers: Headers) {
  headers.set('content-type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}
