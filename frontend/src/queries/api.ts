// This file contains all the interactions with the backend. In testing, we can
// swap this file with a file that serves static data instead of making network
// requests.
import * as Sentry from '@sentry/react';
import { toast } from 'sonner';
import z from 'zod';

import {
  coursePlanningPastGradeSchema,
  type CoursePlanningPastGrade,
} from './coursePlanningViewModels';
import {
  seasonSchema,
  crnSchema,
  type Season,
  type Crn,
  type NetId,
} from './graphql-types';
import {
  completeVerificationErrorMessage,
  requestVerificationErrorMessage,
} from './ucsdAuthErrors';
import { catalogResponseToCatalogData } from './ucsdCatalogSnapshot';
import { API_ENDPOINT } from '../config';
import type {
  CatalogBySeasonQuery,
  EvalsBySeasonQuery,
} from '../generated/graphql-types';
import { createLocalStorageSlot } from '../utilities/browserStorage';
import {
  bumpCatalogCacheBustToken,
  getCatalogCacheBustToken,
  isCatalogEndpoint,
} from '../utilities/catalogCache';

// Coalesce identical concurrent worksheet updates (e.g., double-clicks).
const inflightWorksheetUpdates = new Map<string, Promise<boolean>>();

type BaseFetchOptions = {
  breadcrumb: Sentry.Breadcrumb & {
    message: string;
    category: string;
  };
  cacheBust?: boolean;
  /**
   * Receives the parsed error code. If it returns true, the error is considered
   * handled and no further reporting is done. Only HTTP errors can be handled.
   */
  handleErrorCode?: (errCode: string, payload: unknown) => boolean;
  /**
   * When the API returns a JSON `{ error: "<code>" }` body, map that code to a
   * return value instead of using default toasts / throws. Used e.g. for 404
   * profile vs session expiry (both may use USER_NOT_FOUND).
   */
  mapHttpError?: { [errorCode: string]: unknown };
};

const isJsonParseError = (err: unknown) =>
  err instanceof SyntaxError ||
  (typeof err === 'object' &&
    err !== null &&
    Object.hasOwn(err, 'name') &&
    (err as { name?: string }).name === 'SyntaxError');

const buildApiUrl = (endpointSuffix: string, cacheBust: boolean) => {
  const base = API_ENDPOINT || window.location.origin;
  const url = new URL(`${base}/api${endpointSuffix}`);
  if (isCatalogEndpoint(endpointSuffix)) {
    const token = cacheBust
      ? bumpCatalogCacheBustToken()
      : getCatalogCacheBustToken();
    if (token) url.searchParams.set('cacheBust', token);
  }
  return url.toString();
};

function parseWithWarning<T extends z.ZodSchema<unknown>>(
  schema: T,
  data: unknown,
  breadcrumb: Sentry.Breadcrumb & {
    message: string;
    category: string;
  },
): z.infer<T> | undefined {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  Sentry.addBreadcrumb({
    level: 'info',
    ...breadcrumb,
  });
  Sentry.captureException(res.error);
  toast.error(
    `The server returned a response we cannot understand while ${breadcrumb.message.toLowerCase()}. Please try refreshing the page and/or reopening in a new tab.`,
  );
  return undefined;
}

/**
 * Performs a POST request to the API. No schema provided means no response body
 * is expected. In this case, it returns a boolean indicating whether the
 * request was successful (200 status code).
 */
async function fetchAPI(
  endpointSuffix: string,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  options: BaseFetchOptions & ({ body: {} } | { method: 'POST' }),
): Promise<boolean>;
/**
 * Performs a GET request to the API. Returns a non-null value containing the
 * response body (without validation) if the request was successful, or
 * undefined if an error occurred.
 */
async function fetchAPI(
  endpointSuffix: string,
  options: BaseFetchOptions,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
): Promise<{} | undefined>;
/**
 * Performs either a GET or POST request to the API, depending on whether a body
 * is present. A response body is expected and will be parsed.
 * Returns the parsed response if successful, or undefined if an error occurred.
 */
async function fetchAPI<T extends z.ZodSchema>(
  endpointSuffix: string,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  options: BaseFetchOptions & { body?: {}; schema: T },
): Promise<z.infer<T> | undefined>;
async function fetchAPI(
  endpointSuffix: string,
  options: BaseFetchOptions & {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    body?: {};
    method?: 'POST' | 'GET';
    schema?: z.ZodType<unknown>;
  },
): Promise<unknown> {
  const {
    body,
    method,
    schema,
    breadcrumb,
    handleErrorCode,
    mapHttpError,
    cacheBust,
  } = options;
  const payload = JSON.stringify(body);
  const isCatalogRequest = isCatalogEndpoint(endpointSuffix);
  const shouldCacheBust = Boolean(cacheBust);
  const fetchInit: RequestInit = body
    ? {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      }
    : {
        method: method ?? 'GET',
        credentials: 'include',
      };
  if (isCatalogRequest)
    fetchInit.cache = shouldCacheBust ? 'no-store' : 'no-cache';
  const noResExpected = !schema && fetchInit.method === 'POST';
  try {
    const res = await fetch(
      buildApiUrl(endpointSuffix, shouldCacheBust),
      fetchInit,
    );
    if (!res.ok) {
      let errorCode = '';
      let errorPayload: unknown = null;
      // First: try to parse out a structured error code
      try {
        errorPayload = await res.json();
        const parsedError = (errorPayload as { error?: unknown } | null)?.error;
        errorCode = typeof parsedError === 'string' ? parsedError : '';
      } catch {}
      // Fall back to status text
      errorCode ||= res.statusText;
      if (mapHttpError && errorCode && Object.hasOwn(mapHttpError, errorCode))
        return mapHttpError[errorCode];
      // Handle common errors uniformly
      switch (errorCode) {
        case 'USER_NOT_FOUND':
          toast.info('Login expired. Please log in again.');
          return noResExpected ? false : undefined;
        case 'INVALID_REQUEST':
          toast.error(
            'The server did not understand this request. Please refresh the page and try again.',
          );
          return noResExpected ? false : undefined;
        default:
          // Let the handler handle it first
          if (handleErrorCode?.(errorCode, errorPayload))
            return noResExpected ? false : undefined;
          throw new Error(errorCode);
      }
    }
    // If no res body is expected, return early
    if (noResExpected) return true;
    try {
      const rawData: unknown = await res.json();
      // Only parse if a schema is provided
      if (!schema) return rawData;
      return parseWithWarning(schema, rawData, breadcrumb);
    } catch (err) {
      if (isCatalogRequest && !shouldCacheBust && isJsonParseError(err)) {
        return await fetchAPI(endpointSuffix, {
          ...options,
          cacheBust: true,
        });
      }
      throw err;
    }
  } catch (err) {
    Sentry.addBreadcrumb({
      level: 'info',
      ...breadcrumb,
      message: body ? `${breadcrumb.message} ${payload}` : breadcrumb.message,
    });
    Sentry.captureException(err);
    toast.error(
      `Failed while ${breadcrumb.message.toLowerCase()}: ${String(err)}`,
    );
    return noResExpected ? false : undefined;
  }
}

type UpdateWorksheetCourseAction = {
  season: Season;
  crn: Crn;
  worksheetNumber: number;
} & (
  | {
      action: 'add';
      color: string;
      hidden: boolean;
    }
  | {
      action: 'remove' | 'update';
      color?: string;
      hidden?: boolean;
    }
);

export async function updateWorksheetCourses(
  body: UpdateWorksheetCourseAction | UpdateWorksheetCourseAction[],
): Promise<boolean> {
  const MAX_BATCH_SIZE = 50; // Keep payloads small to avoid 413 Request Entity Too Large.

  const requestInternal = (
    payload: UpdateWorksheetCourseAction | UpdateWorksheetCourseAction[],
  ) =>
    fetchAPI('/user/updateWorksheetCourses', {
      body: payload,
      handleErrorCode(err) {
        switch (err) {
          // These errors can be triggered if the user clicks the button twice
          // in a row. we coalesce identical in-flight requests above to avoid
          // the race but keep the handler for safety.
          case 'ALREADY_BOOKMARKED':
            toast.error('You have already added this class to your worksheet');
            return true;
          case 'NOT_BOOKMARKED':
            toast.error(
              'You have already removed this class from your worksheet',
            );
            return true;
          case 'WORKSHEET_NOT_FOUND':
            toast.error(
              'That worksheet does not exist for this season. Try your main worksheet.',
            );
            return true;
          default:
            return false;
        }
      },
      breadcrumb: {
        category: 'worksheet',
        message: 'Updating worksheet',
      },
    });

  const request = (
    payload: UpdateWorksheetCourseAction | UpdateWorksheetCourseAction[],
  ) => {
    const key = JSON.stringify(payload);
    const existing = inflightWorksheetUpdates.get(key);
    if (existing) return existing;
    const pending = requestInternal(payload).finally(() =>
      inflightWorksheetUpdates.delete(key),
    );
    inflightWorksheetUpdates.set(key, pending);
    return pending;
  };

  if (!Array.isArray(body) || body.length <= MAX_BATCH_SIZE)
    return request(body);

  for (let i = 0; i < body.length; i += MAX_BATCH_SIZE) {
    const batch = body.slice(i, i + MAX_BATCH_SIZE);
    if (batch.length === 0) continue;
    if (batch.length === 1) {
      const [single] = batch;
      const ok = await request(single!);
      if (!ok) return false;
    } else {
      const ok = await request(batch);
      if (!ok) return false;
    }
  }

  return true;
}

export async function updateWorksheetMetadata(
  body: {
    season: Season;
  } & (
    | {
        action: 'add';
        name: string;
      }
    | {
        action: 'delete';
        worksheetNumber: number;
      }
    | {
        action: 'rename';
        worksheetNumber: number;
        name: string;
      }
    | {
        action: 'setPrivate';
        worksheetNumber: number;
        private: boolean;
      }
  ),
): Promise<boolean> {
  return await fetchAPI('/user/updateWorksheetMetadata', {
    body,
    breadcrumb: {
      category: 'worksheet',
      message: `Updating worksheet names`,
    },
    handleErrorCode(err) {
      switch (err) {
        case 'WORKSHEET_NOT_FOUND':
          toast.error('Worksheet not found.');
          return true;
        default:
          return false;
      }
    },
  });
}

const hiddenCoursesStorage = createLocalStorageSlot<{
  [seasonCode: Season]: { [crn: Crn]: boolean };
}>('hiddenCourses');

export function setCourseHidden({
  season,
  worksheetNumber,
  crn,
  hidden,
}: {
  season: Season;
  worksheetNumber: number;
  crn: Crn | Crn[];
  hidden: boolean;
}): Promise<boolean> {
  if (Array.isArray(crn)) {
    const actions = crn.map((c) => ({
      action: 'update',
      season,
      worksheetNumber,
      crn: c,
      hidden,
    }));
    return fetchAPI('/user/updateWorksheetCourses', {
      body: actions,
      breadcrumb: {
        category: 'worksheet',
        message: 'Batch updating worksheet hidden status',
      },
    });
  }
  return fetchAPI('/user/updateWorksheetCourses', {
    body: {
      action: 'update',
      season,
      crn,
      worksheetNumber,
      hidden,
    },
    breadcrumb: {
      category: 'worksheet',
      message: 'Updating worksheet hidden status',
    },
  });
}

// One Supported Term advertised by the Catalog Snapshot pipeline's term
// registry. The catalog term selector is driven by this list (UCSD alpha term
// codes), not the inherited numeric Yale season codes. See ADR 0012.
const supportedTermSchema = z.object({
  term: z.string(),
  label: z.string(),
  date_range: z.object({ start: z.string(), end: z.string() }).nullable(),
  frozen: z.boolean(),
  generated_at: z.string(),
  snapshot_path: z.string(),
  detail_path: z.string().nullable().optional(),
  manifest_path: z.string().nullable(),
});

export type SupportedTerm = z.infer<typeof supportedTermSchema>;

const catalogMetadataSchema = z.object({
  last_update: z.string().transform((x) => new Date(x)),
  // Optional for backward compatibility with single-term metadata.
  terms: z.array(supportedTermSchema).optional(),
});

export type CatalogMetadata = z.infer<typeof catalogMetadataSchema>;

export function fetchCatalogMetadata() {
  return fetchAPI('/catalog/metadata', {
    breadcrumb: {
      category: 'catalog',
      message: 'Fetching catalog metadata',
    },
    schema: catalogMetadataSchema,
  });
}

type CoursePublic = CatalogBySeasonQuery['courses'][number];

export async function fetchCatalog(season: Season) {
  const breadcrumb = {
    category: 'catalog',
    message: `Fetching catalog ${season}`,
  };
  const res = await fetchAPI(`/catalog/public/${season}`, {
    breadcrumb,
  });
  if (!res) return undefined;
  return catalogResponseToCatalogData(res);
}

const catalogDetailsSchema = z.object({
  run_id: z.string(),
  generated_at: z.string(),
  active_planning_term: z.string(),
  courses: z.array(
    z.object({
      course_id: z.string(),
      grade_archive_records: z.array(coursePlanningPastGradeSchema),
    }),
  ),
});

export async function fetchCatalogDetails(season: Season) {
  const res = await fetchAPI(`/catalog/details/${season}`, {
    breadcrumb: {
      category: 'catalog',
      message: `Fetching catalog details ${season}`,
    },
    schema: catalogDetailsSchema,
  });
  if (!res || res.active_planning_term !== season) return undefined;
  return new Map<string, CoursePlanningPastGrade[]>(
    res.courses.map((course) => [
      course.course_id,
      course.grade_archive_records,
    ]),
  );
}

type CourseEvals = EvalsBySeasonQuery['courses'][number];

type CourseMeetingWithLocation = CoursePublic['course_meetings'][number] & {
  location?: CourseEvals['course_meetings'][number]['location'];
};

type CoursePublicWithOptionalLocation = Omit<
  CoursePublic,
  'course_meetings'
> & {
  course_meetings: CourseMeetingWithLocation[];
};

export type CatalogListing = CoursePublic['listings'][number] & {
  course: CoursePublicWithOptionalLocation &
    Partial<Omit<CourseEvals, 'course_meetings'>>;
};

export async function fetchEvals(season: Season) {
  const res = await fetchAPI(`/catalog/evals/${season}`, {
    breadcrumb: {
      category: 'evals',
      message: `Fetching evals ${season}`,
    },
  });
  if (!res) return undefined;
  const data = res as EvalsBySeasonQuery['courses'];
  const info = new Map<number, CourseEvals>();
  for (const course of data) info.set(course.course_id, course);
  return info;
}

export async function logout() {
  const res = await fetchAPI('/auth/logout', {
    method: 'POST',
    breadcrumb: {
      category: 'user',
      message: 'Signing out',
    },
  });
  return res;
}

export type AppUserInfo = {
  user_id: number;
  verifiedEmail: string;
};

// Shared schema for worksheet courses (used by both user and friends)
const worksheetCourseSchema = z.object({
  crn: crnSchema,
  color: z.string(),
  hidden: z.boolean().nullable(),
  sameCourseId: z.number().nullable().optional(),
});

// Shared schema for worksheet structure
const worksheetSchema = z.object({
  name: z.string(),
  private: z.boolean().optional(),
  courses: z.array(worksheetCourseSchema),
});

// Shared schema for season/worksheet mapping with transform
const worksheetsMapSchema = z
  .record(
    // Key: season
    z.record(
      // Key: worksheet number
      worksheetSchema,
    ),
  )
  .transform((data) => {
    type Worksheet = NonNullable<(typeof data)[Season]>[string];
    // Transform the object record to a map
    const res = new Map<Season, Map<number, Worksheet>>();
    for (const season of Object.keys(data)) {
      const seasonMap = new Map<number, Worksheet>();
      for (const num of Object.keys(data[season]!))
        seasonMap.set(Number(num), data[season]![num]!);
      res.set(season as Season, seasonMap);
    }
    return res;
  });

const userWorksheetsSchema = worksheetsMapSchema;

// Change index type to be more specific. We don't use the key type of z.record
// on purpose; see https://github.com/colinhacks/zod/pull/2287
export type UserWorksheets = z.infer<typeof userWorksheetsSchema>;

export async function fetchUserWorksheets() {
  const res = await fetchAPI('/user/worksheets', {
    schema: z.object({
      data: userWorksheetsSchema,
      sameCourseIdToCrns: z.record(z.array(z.number())),
    }),
    breadcrumb: {
      category: 'user',
      message: 'Fetching user data',
    },
  });
  if (!res) return undefined;
  const hiddenCourses = hiddenCoursesStorage.get();
  if (!hiddenCourses) return res;
  // If the server doesn't know about the hidden status for any course, but
  // there exists locally stored data, then we use this and sync it with the
  // server. This is a one-time operation to migrate from our old client-side
  // logic to be server-side, to make it consistent between devices and friends.
  const actions = [];
  for (const [season, seasonWorksheets] of res.data) {
    for (const [num, worksheet] of seasonWorksheets) {
      for (const course of worksheet.courses) {
        if (course.hidden === null) {
          course.hidden = hiddenCourses[season]?.[course.crn] ?? false;
          actions.push({
            action: 'update',
            season,
            crn: course.crn,
            worksheetNumber: num,
            hidden: course.hidden,
          });
        }
      }
    }
  }
  if (actions.length) {
    const updateRes = await fetchAPI('/user/updateWorksheetCourses', {
      body: actions,
      breadcrumb: {
        category: 'worksheet',
        message: 'Syncing hidden courses',
      },
    });
    // No longer need this data
    if (updateRes) hiddenCoursesStorage.remove();
  } else {
    // There's no data to update, which means it's already synced from another
    // device. We use the "first-wins" strategy and only sync data from the
    // first device that logged in, and assume that one is the primary device.
    hiddenCoursesStorage.remove();
  }
  return res;
}

export type FriendRecord = {
  [netId: NetId]: {
    name: string | null;
    worksheets: UserWorksheets;
  };
};

const worksheetDemandSchema = z.object({
  demand: z.number().int().nonnegative(),
});

export async function fetchWorksheetDemand(crn: number, season: string) {
  return fetchAPI(`/demand/worksheet?crn=${crn}&season=${season}`, {
    schema: worksheetDemandSchema,
    breadcrumb: {
      category: 'demand',
      message: 'Fetching worksheet demand',
    },
  });
}

const authenticatedCurrentUserSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({
    user_id: z.number().int().positive(),
    verified_email: z.string(),
  }),
});

const currentUserResponseSchema = z.union([
  authenticatedCurrentUserSchema,
  z.object({
    authenticated: z.literal(false),
    user: z.null(),
  }),
]);

const compatibleCurrentUserResponseSchema = z.preprocess((data) => {
  if (
    typeof data === 'object' &&
    data !== null &&
    !Object.hasOwn(data, 'authenticated') &&
    (data as { user?: unknown }).user === null
  )
    return { authenticated: false, user: null };
  return data;
}, currentUserResponseSchema);

function appUserResponseToUserInfo(
  user: z.infer<typeof currentUserResponseSchema>['user'],
): AppUserInfo {
  if (!user) throw new Error('Cannot convert anonymous user');
  return {
    user_id: user.user_id,
    verifiedEmail: user.verified_email,
  };
}

export async function fetchCurrentUser(): Promise<
  AppUserInfo | null | undefined
> {
  const res = await fetchAPI('/auth/current-user', {
    schema: compatibleCurrentUserResponseSchema,
    breadcrumb: {
      category: 'user',
      message: 'Fetching current user',
    },
  });
  if (!res) {
    Sentry.getCurrentScope().clear();
    return undefined;
  }
  if (!res.authenticated) {
    Sentry.getCurrentScope().clear();
    return null;
  }
  const user = appUserResponseToUserInfo(res.user);
  Sentry.setUser({
    id: String(user.user_id),
  });
  return user;
}

export async function checkAuth() {
  return Boolean(await fetchCurrentUser());
}

const requestVerificationSchema = z.object({
  status: z.literal('verification_sent'),
  email: z.string(),
  devCode: z.string().optional(),
});

export async function requestUcsdVerification(
  email: string,
): Promise<
  | { status: 'sent'; email: string; devCode?: string }
  | { status: 'rejected'; message: string }
  | { status: 'error' }
> {
  let rejectedMessage = '';
  const res = await fetchAPI('/auth/ucsd/request-verification', {
    body: { email },
    schema: requestVerificationSchema,
    breadcrumb: {
      category: 'auth',
      message: 'Requesting UCSD email verification',
    },
    handleErrorCode(err, payload) {
      const parsedRetry = z
        .object({ retryAfterSeconds: z.number() })
        .safeParse(payload);
      const retryAfterSeconds = parsedRetry.success
        ? parsedRetry.data.retryAfterSeconds
        : undefined;
      const message = requestVerificationErrorMessage(err, retryAfterSeconds);
      if (message) {
        rejectedMessage = message;
        return true;
      }
      return false;
    },
  });
  if (!res) {
    if (rejectedMessage)
      return { status: 'rejected', message: rejectedMessage };
    return { status: 'error' };
  }
  return {
    status: 'sent',
    email: res.email,
    devCode: res.devCode,
  };
}

export async function verifyUcsdEmail(
  email: string,
  code: string,
): Promise<
  | { status: 'authenticated'; user: AppUserInfo }
  | { status: 'rejected'; message: string }
  | { status: 'error' }
> {
  let rejectedMessage = '';
  const res = await fetchAPI('/auth/ucsd/verify', {
    body: { email, code },
    schema: authenticatedCurrentUserSchema,
    breadcrumb: {
      category: 'auth',
      message: 'Completing UCSD email verification',
    },
    handleErrorCode(err, payload) {
      const parsedRetry = z
        .object({ retryAfterSeconds: z.number() })
        .safeParse(payload);
      const message = completeVerificationErrorMessage(
        err,
        parsedRetry.success ? parsedRetry.data.retryAfterSeconds : undefined,
      );
      if (message) {
        rejectedMessage = message;
        return true;
      }
      return false;
    },
  });
  if (!res) {
    if (rejectedMessage)
      return { status: 'rejected', message: rejectedMessage };
    return { status: 'error' };
  }
  const user = appUserResponseToUserInfo(res.user);
  Sentry.setUser({
    id: String(user.user_id),
  });
  return { status: 'authenticated', user };
}

// Saved Searches API

const savedSearchSchema = z.object({
  id: z.number(),
  name: z.string(),
  queryString: z.string(),
  createdAt: z.number(),
});

export type SavedSearch = z.infer<typeof savedSearchSchema>;

export async function fetchSavedSearches() {
  return await fetchAPI(`/savedSearches?_=${Date.now()}`, {
    schema: z.object({
      data: z.array(savedSearchSchema),
    }),
    breadcrumb: {
      category: 'savedSearches',
      message: 'Fetching saved searches',
    },
  });
}

export async function createSavedSearch(name: string, queryString: string) {
  return await fetchAPI('/savedSearches/create', {
    body: { name, queryString },
    schema: savedSearchSchema,
    breadcrumb: {
      category: 'savedSearches',
      message: 'Creating saved search',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'DUPLICATE_NAME':
          toast.error('A saved search with this name already exists');
          return true;
        default:
          return false;
      }
    },
  });
}

export async function deleteSavedSearch(id: number) {
  return await fetchAPI('/savedSearches/delete', {
    body: { id },
    breadcrumb: {
      category: 'savedSearches',
      message: 'Deleting saved search',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'SEARCH_NOT_FOUND':
          toast.error('Saved search not found');
          return true;
        default:
          return false;
      }
    },
  });
}

// Saved Worksheets API

const savedWorksheetSectionSchema = z.object({
  sectionId: z.string(),
  color: z.string(),
  hidden: z.boolean(),
});

const savedWorksheetSchema = z.object({
  id: z.number(),
  name: z.string(),
  term: seasonSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  private: z.boolean(),
  isMain: z.boolean(),
  sourceSectionCount: z.number(),
  savedSectionCount: z.number(),
  sections: z.array(savedWorksheetSectionSchema),
});

const savedWorksheetSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  term: seasonSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  private: z.boolean(),
  isMain: z.boolean(),
  sectionCount: z.number(),
});

export type SavedWorksheet = z.infer<typeof savedWorksheetSchema>;
export type SavedWorksheetSection = z.infer<typeof savedWorksheetSectionSchema>;
export type SavedWorksheetSummary = z.infer<typeof savedWorksheetSummarySchema>;
export type CreateBlankSavedWorksheetInput = {
  name?: string;
  term: Season;
};
export type DeleteSavedWorksheetResponse = {
  deletedId: number;
  term: Season;
  fallbackWorksheet: SavedWorksheet | null;
};

export type SaveAnonymousWorksheetInput = {
  name: string;
  term: Season;
  courses: {
    sectionId: string;
    color: string;
    hidden: boolean;
  }[];
};

export async function createSavedWorksheetFromAnonymous(
  body: SaveAnonymousWorksheetInput,
) {
  return await fetchAPI('/savedWorksheets/from-anonymous', {
    body,
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Saving anonymous worksheet',
    },
  });
}

export async function ensureMainSavedWorksheet(term: Season) {
  return await fetchAPI('/savedWorksheets/ensure-main', {
    body: { term },
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Opening Main Worksheet',
    },
  });
}

export async function createBlankSavedWorksheet(
  body: CreateBlankSavedWorksheetInput,
) {
  return await fetchAPI('/savedWorksheets/create-blank', {
    body,
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Creating blank saved worksheet',
    },
  });
}

export async function renameSavedWorksheet(id: number, name: string) {
  return await fetchAPI(`/savedWorksheets/${id}/rename`, {
    body: { name },
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Renaming saved worksheet',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'SAVED_WORKSHEET_NOT_FOUND':
          toast.error('Saved worksheet not found');
          return true;
        case 'MAIN_SAVED_WORKSHEET_CANNOT_BE_RENAMED':
          toast.error('Main Worksheet cannot be renamed.');
          return true;
        default:
          return false;
      }
    },
  });
}

export async function deleteSavedWorksheet(id: number) {
  return await fetchAPI(`/savedWorksheets/${id}/delete`, {
    body: {},
    schema: z.object({
      deletedId: z.number(),
      term: seasonSchema,
      fallbackWorksheet: savedWorksheetSchema.nullable(),
    }),
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Deleting saved worksheet',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'SAVED_WORKSHEET_NOT_FOUND':
          toast.error('Saved worksheet not found');
          return true;
        case 'ONLY_SAVED_WORKSHEET_CANNOT_BE_DELETED':
          toast.error('The only Saved Worksheet in a term cannot be deleted.');
          return true;
        case 'MAIN_SAVED_WORKSHEET_CANNOT_BE_DELETED':
          toast.error('Main Worksheet cannot be deleted.');
          return true;
        default:
          return false;
      }
    },
  });
}

export async function updateSavedWorksheetSections(
  id: number,
  sections: SavedWorksheetSection[],
) {
  return await fetchAPI(`/savedWorksheets/${id}/sections`, {
    body: { sections },
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Updating saved worksheet sections',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'SAVED_WORKSHEET_NOT_FOUND':
          toast.error('Saved worksheet not found');
          return true;
        default:
          return false;
      }
    },
  });
}

export async function fetchSavedWorksheets(term?: Season) {
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (term) params.set('term', term);
  return await fetchAPI(`/savedWorksheets?${params.toString()}`, {
    schema: z.object({
      data: z.array(savedWorksheetSummarySchema),
    }),
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Fetching saved worksheets',
    },
  });
}

export async function fetchSavedWorksheet(id: number) {
  return await fetchAPI(`/savedWorksheets/${id}?_=${Date.now()}`, {
    schema: savedWorksheetSchema,
    breadcrumb: {
      category: 'savedWorksheets',
      message: 'Fetching saved worksheet',
    },
    handleErrorCode(err) {
      switch (err) {
        case 'SAVED_WORKSHEET_NOT_FOUND':
          toast.error('Saved worksheet not found');
          return true;
        default:
          return false;
      }
    },
  });
}
