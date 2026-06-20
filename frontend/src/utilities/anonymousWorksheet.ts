import type { CatalogListing, UserWorksheets } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';

export const ANONYMOUS_WORKSHEET_STORAGE_KEY = 'anonymousWorksheet';
export const ANONYMOUS_WORKSHEET_NAME = 'Anonymous Worksheet';

export type AnonymousWorksheetCourse = {
  sectionId: string;
  color: string;
  hidden: boolean;
};

export type AnonymousWorksheetState = {
  term: Season;
  courses: AnonymousWorksheetCourse[];
};

export type AnonymousWorksheetShare = {
  term: Season;
  sectionIds: string[];
};

export type AnonymousWorksheetListing = {
  crn: Crn;
  course?: {
    season_code?: Season;
    same_course_id?: number;
    listings?: {
      crn: Crn;
      section_id?: unknown;
    }[];
  };
  section_id?: unknown;
};

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function normalizeCourse(value: unknown): AnonymousWorksheetCourse | null {
  if (!isRecord(value)) return null;
  const { sectionId, color, hidden } = value;
  if (typeof sectionId !== 'string' || sectionId.length === 0) return null;
  if (typeof color !== 'string' || color.length === 0) return null;
  return {
    sectionId,
    color,
    hidden: typeof hidden === 'boolean' ? hidden : false,
  };
}

export function normalizeAnonymousWorksheet(
  value: unknown,
  fallbackTerm: Season,
): AnonymousWorksheetState {
  if (!isRecord(value)) return { term: fallbackTerm, courses: [] };
  const term =
    typeof value.term === 'string' ? (value.term as Season) : fallbackTerm;
  const courses = Array.isArray(value.courses)
    ? value.courses.flatMap((course) => {
        const normalized = normalizeCourse(course);
        return normalized ? [normalized] : [];
      })
    : [];
  return dedupeAnonymousWorksheet({ term, courses });
}

export function readAnonymousWorksheetStorage(
  fallbackTerm: Season,
): AnonymousWorksheetState {
  if (typeof window === 'undefined') return { term: fallbackTerm, courses: [] };
  try {
    const raw = window.localStorage.getItem(ANONYMOUS_WORKSHEET_STORAGE_KEY);
    if (!raw) return { term: fallbackTerm, courses: [] };
    return normalizeAnonymousWorksheet(JSON.parse(raw), fallbackTerm);
  } catch {
    return { term: fallbackTerm, courses: [] };
  }
}

export function writeAnonymousWorksheetStorage(
  worksheet: AnonymousWorksheetState,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    ANONYMOUS_WORKSHEET_STORAGE_KEY,
    JSON.stringify(worksheet),
  );
}

export function getListingSectionId(
  listing: AnonymousWorksheetListing,
): string | null {
  if (typeof listing.section_id === 'string' && listing.section_id.length > 0)
    return listing.section_id;
  const matchingListing = listing.course?.listings?.find(
    (courseListing) => courseListing.crn === listing.crn,
  );
  if (
    typeof matchingListing?.section_id === 'string' &&
    matchingListing.section_id.length > 0
  )
    return matchingListing.section_id;
  return null;
}

export function anonymousWorksheetHasListing(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
): boolean {
  const sectionId = getListingSectionId(listing);
  return Boolean(
    sectionId &&
    worksheet.courses.some((course) => course.sectionId === sectionId),
  );
}

export function addListingToAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  color: string,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  const term = listing.course?.season_code ?? worksheet.term;
  if (worksheet.courses.some((course) => course.sectionId === sectionId))
    return worksheet;
  return {
    term,
    courses: [
      ...worksheet.courses,
      {
        sectionId,
        color,
        hidden: false,
      },
    ],
  };
}

export function removeListingFromAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  return {
    ...worksheet,
    courses: worksheet.courses.filter(
      (course) => course.sectionId !== sectionId,
    ),
  };
}

export function setAnonymousWorksheetCourseHidden(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  hidden: boolean,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  return {
    ...worksheet,
    courses: worksheet.courses.map((course) =>
      course.sectionId === sectionId ? { ...course, hidden } : course,
    ),
  };
}

export function setAnonymousWorksheetCourseColor(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  color: string,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  return {
    ...worksheet,
    courses: worksheet.courses.map((course) =>
      course.sectionId === sectionId ? { ...course, color } : course,
    ),
  };
}

export function setAllAnonymousWorksheetCoursesHidden(
  worksheet: AnonymousWorksheetState,
  hidden: boolean,
): AnonymousWorksheetState {
  return {
    ...worksheet,
    courses: worksheet.courses.map((course) => ({ ...course, hidden })),
  };
}

export function dedupeAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
): AnonymousWorksheetState {
  const seen = new Set<string>();
  const courses: AnonymousWorksheetCourse[] = [];
  for (const course of worksheet.courses) {
    if (seen.has(course.sectionId)) continue;
    seen.add(course.sectionId);
    courses.push(course);
  }
  return { ...worksheet, courses };
}

export function parseAnonymousWorksheetShare(
  searchParams: URLSearchParams,
  fallbackTerm: Season,
): AnonymousWorksheetShare | null {
  const rawSections = searchParams.get('sections');
  if (rawSections === null) return null;
  const term = (searchParams.get('t') || fallbackTerm) as Season;
  const sectionIds = rawSections
    .split(',')
    .map((sectionId) => sectionId.trim())
    .filter(Boolean);
  return { term, sectionIds: [...new Set(sectionIds)] };
}

export function anonymousWorksheetFromShare(
  share: AnonymousWorksheetShare,
  getColor: (index: number) => string,
): AnonymousWorksheetState {
  return {
    term: share.term,
    courses: share.sectionIds.map((sectionId, index) => ({
      sectionId,
      color: getColor(index),
      hidden: false,
    })),
  };
}

export function toAnonymousWorksheetShare(
  term: Season,
  sectionIds: string[],
): AnonymousWorksheetShare {
  return { term, sectionIds: [...new Set(sectionIds)] };
}

export function createAnonymousWorksheetShareUrl(
  origin: string,
  share: AnonymousWorksheetShare,
): string {
  const params = new URLSearchParams();
  params.set('t', share.term);
  params.set('sections', share.sectionIds.join(','));
  return `${origin}/worksheet?${params.toString()}`;
}

export function resolveAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
  catalog: Map<Crn, CatalogListing> | undefined,
): { worksheets: UserWorksheets; missingSectionIds: string[] } {
  type Worksheet =
    UserWorksheets extends Map<Season, Map<number, infer W>> ? W : never;
  const seasonWorksheets = new Map<number, Worksheet>();
  const worksheets: UserWorksheets = new Map([
    [worksheet.term, seasonWorksheets],
  ]);

  if (!catalog) {
    seasonWorksheets.set(0, {
      name: ANONYMOUS_WORKSHEET_NAME,
      private: false,
      courses: [],
    });
    return { worksheets, missingSectionIds: [] };
  }

  const listingsBySectionId = new Map<string, CatalogListing>();
  for (const listing of catalog.values()) {
    const sectionId = getListingSectionId(listing);
    if (sectionId) listingsBySectionId.set(sectionId, listing);
  }

  const missingSectionIds: string[] = [];
  const courses = worksheet.courses.flatMap((course) => {
    const listing = listingsBySectionId.get(course.sectionId);
    if (!listing) {
      missingSectionIds.push(course.sectionId);
      return [];
    }
    return [
      {
        crn: listing.crn,
        color: course.color,
        hidden: course.hidden,
        sameCourseId: listing.course.same_course_id,
      },
    ];
  });

  seasonWorksheets.set(0, {
    name: ANONYMOUS_WORKSHEET_NAME,
    private: false,
    courses,
  });

  return { worksheets, missingSectionIds };
}
