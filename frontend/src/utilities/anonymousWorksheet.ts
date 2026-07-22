import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Crn, Season } from '../queries/graphql-types';
import {
  coursePlanningListingToWorksheetCourse,
  type WorksheetCourse,
} from '../types/worksheetCourse';

export const ANONYMOUS_WORKSHEET_STORAGE_KEY = 'anonymousWorksheet';
export const ANONYMOUS_WORKSHEET_NAME = 'Main Worksheet';

export type AnonymousWorksheetCourse = {
  sectionId: string;
  color: string;
  hidden: boolean;
};

export type AnonymousWorksheetState = {
  term: Season;
  coursesByTerm: { [term: string]: AnonymousWorksheetCourse[] | undefined };
};

export type AnonymousWorksheetShare = {
  term: Season;
  sectionIds: string[];
};

export type WorksheetSectionIdMigration = {
  from: string;
  to: string;
};

export type CoursePlanningWorksheetListing = {
  section: {
    sectionId: string;
    supportedTerm: string;
  };
};

export type LegacyAnonymousWorksheetListing = {
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

export type AnonymousWorksheetListing =
  | CoursePlanningWorksheetListing
  | LegacyAnonymousWorksheetListing;

function isCoursePlanningWorksheetListing(
  listing: AnonymousWorksheetListing,
): listing is CoursePlanningWorksheetListing {
  return Object.hasOwn(listing, 'section');
}

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
  if (!isRecord(value)) return { term: fallbackTerm, coursesByTerm: {} };
  const term =
    typeof value.term === 'string' ? (value.term as Season) : fallbackTerm;
  const coursesByTerm: AnonymousWorksheetState['coursesByTerm'] = {};

  if (isRecord(value.coursesByTerm)) {
    for (const [rawTerm, rawCourses] of Object.entries(value.coursesByTerm)) {
      if (!Array.isArray(rawCourses)) continue;
      coursesByTerm[rawTerm] = rawCourses.flatMap((course) => {
        const normalized = normalizeCourse(course);
        return normalized ? [normalized] : [];
      });
    }
  } else if (Array.isArray(value.courses)) {
    coursesByTerm[term] = value.courses.flatMap((course) => {
      const normalized = normalizeCourse(course);
      return normalized ? [normalized] : [];
    });
  }

  return dedupeAnonymousWorksheet({ term, coursesByTerm });
}

export function readAnonymousWorksheetStorage(
  fallbackTerm: Season,
): AnonymousWorksheetState {
  if (typeof window === 'undefined')
    return { term: fallbackTerm, coursesByTerm: {} };
  try {
    const raw = window.localStorage.getItem(ANONYMOUS_WORKSHEET_STORAGE_KEY);
    if (!raw) return { term: fallbackTerm, coursesByTerm: {} };
    return normalizeAnonymousWorksheet(JSON.parse(raw), fallbackTerm);
  } catch {
    return { term: fallbackTerm, coursesByTerm: {} };
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
  if (isCoursePlanningWorksheetListing(listing))
    return listing.section.sectionId;
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

export function getListingTerm(
  listing: AnonymousWorksheetListing,
  fallbackTerm: Season,
): Season {
  if (isCoursePlanningWorksheetListing(listing))
    return listing.section.supportedTerm as Season;
  return listing.course?.season_code ?? fallbackTerm;
}

export function anonymousWorksheetHasListing(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
): boolean {
  const sectionId = getListingSectionId(listing);
  const term = getListingTerm(listing, worksheet.term);
  return Boolean(
    sectionId &&
    getAnonymousWorksheetCourses(worksheet, term).some(
      (course) => course.sectionId === sectionId,
    ),
  );
}

export function getAnonymousWorksheetCourses(
  worksheet: AnonymousWorksheetState,
  term: Season = worksheet.term,
): AnonymousWorksheetCourse[] {
  return worksheet.coursesByTerm[term] ?? [];
}

function updateAnonymousWorksheetCourses(
  worksheet: AnonymousWorksheetState,
  term: Season,
  update: (courses: AnonymousWorksheetCourse[]) => AnonymousWorksheetCourse[],
): AnonymousWorksheetState {
  const currentCourses = getAnonymousWorksheetCourses(worksheet, term);
  return dedupeAnonymousWorksheet({
    ...worksheet,
    coursesByTerm: {
      ...worksheet.coursesByTerm,
      [term]: update(currentCourses),
    },
  });
}

export function addListingToAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  color: string,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  const term = getListingTerm(listing, worksheet.term);
  const termCourses = getAnonymousWorksheetCourses(worksheet, term);
  if (termCourses.some((course) => course.sectionId === sectionId))
    return worksheet;
  return updateAnonymousWorksheetCourses(worksheet, term, (courses) => [
    ...courses,
    {
      sectionId,
      color,
      hidden: false,
    },
  ]);
}

export function removeListingFromAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  const term = getListingTerm(listing, worksheet.term);
  return updateAnonymousWorksheetCourses(worksheet, term, (courses) =>
    courses.filter((course) => course.sectionId !== sectionId),
  );
}

export function setAnonymousWorksheetCourseHidden(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  hidden: boolean,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  const term = getListingTerm(listing, worksheet.term);
  return updateAnonymousWorksheetCourses(worksheet, term, (courses) =>
    courses.map((course) =>
      course.sectionId === sectionId ? { ...course, hidden } : course,
    ),
  );
}

export function setAnonymousWorksheetCourseColor(
  worksheet: AnonymousWorksheetState,
  listing: AnonymousWorksheetListing,
  color: string,
): AnonymousWorksheetState {
  const sectionId = getListingSectionId(listing);
  if (!sectionId) return worksheet;
  const term = getListingTerm(listing, worksheet.term);
  return updateAnonymousWorksheetCourses(worksheet, term, (courses) =>
    courses.map((course) =>
      course.sectionId === sectionId ? { ...course, color } : course,
    ),
  );
}

export function setAllAnonymousWorksheetCoursesHidden(
  worksheet: AnonymousWorksheetState,
  hidden: boolean,
  term: Season = worksheet.term,
): AnonymousWorksheetState {
  return {
    ...worksheet,
    coursesByTerm: {
      ...worksheet.coursesByTerm,
      [term]: getAnonymousWorksheetCourses(worksheet, term).map((course) => ({
        ...course,
        hidden,
      })),
    },
  };
}

export function dedupeAnonymousWorksheet(
  worksheet: AnonymousWorksheetState,
): AnonymousWorksheetState {
  const coursesByTerm: AnonymousWorksheetState['coursesByTerm'] = {};
  for (const [term, courses] of Object.entries(worksheet.coursesByTerm)) {
    const seen = new Set<string>();
    const deduped: AnonymousWorksheetCourse[] = [];
    for (const course of courses ?? []) {
      if (seen.has(course.sectionId)) continue;
      seen.add(course.sectionId);
      deduped.push(course);
    }
    coursesByTerm[term] = deduped;
  }
  return { ...worksheet, coursesByTerm };
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
    coursesByTerm: {
      [share.term]: share.sectionIds.map((sectionId, index) => ({
        sectionId,
        color: getColor(index),
        hidden: false,
      })),
    },
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

function packageSectionIdentity(sectionId: string) {
  const [term, course, rawComponents, ...rest] = sectionId.split(':');
  if (!term || !course || !rawComponents || rest.length > 0) return null;
  const components = rawComponents.split('+');
  if (components.some((component) => component.length === 0)) return null;
  return { namespace: `${term}:${course}`, components };
}

function findUniqueExpandedSectionId(
  sectionId: string,
  listingsBySectionId: Map<string, CoursePlanningListing>,
) {
  const storedIdentity = packageSectionIdentity(sectionId);
  if (!storedIdentity) return null;

  const storedComponents = new Set(storedIdentity.components);
  const matches: string[] = [];
  for (const candidateId of listingsBySectionId.keys()) {
    const candidateIdentity = packageSectionIdentity(candidateId);
    if (
      !candidateIdentity ||
      candidateIdentity.namespace !== storedIdentity.namespace ||
      candidateIdentity.components.length <= storedComponents.size ||
      ![...storedComponents].every((component) =>
        candidateIdentity.components.includes(component),
      )
    )
      continue;
    matches.push(candidateId);
    if (matches.length > 1) return null;
  }
  return matches[0] ?? null;
}

export function migrateWorksheetSectionIds(
  sections: AnonymousWorksheetCourse[],
  migrations: WorksheetSectionIdMigration[],
): AnonymousWorksheetCourse[] {
  if (migrations.length === 0) return sections;
  const migratedIds = new Map(
    migrations.map((migration) => [migration.from, migration.to]),
  );
  const seen = new Set<string>();
  return sections.flatMap((section) => {
    const sectionId = migratedIds.get(section.sectionId) ?? section.sectionId;
    if (seen.has(sectionId)) return [];
    seen.add(sectionId);
    return [{ ...section, sectionId }];
  });
}

export function resolveAnonymousWorksheetCourses(
  worksheet: AnonymousWorksheetState,
  listingsBySectionId: Map<string, CoursePlanningListing> | undefined,
  term: Season = worksheet.term,
): {
  courses: WorksheetCourse[];
  missingSectionIds: string[];
  sectionIdMigrations: WorksheetSectionIdMigration[];
} {
  if (!listingsBySectionId)
    return { courses: [], missingSectionIds: [], sectionIdMigrations: [] };

  const missingSectionIds: string[] = [];
  const sectionIdMigrations: WorksheetSectionIdMigration[] = [];
  const courses = getAnonymousWorksheetCourses(worksheet, term).flatMap(
    (course) => {
      const resolvedSectionId =
        (listingsBySectionId.has(course.sectionId) && course.sectionId) ||
        findUniqueExpandedSectionId(course.sectionId, listingsBySectionId);
      const listing = resolvedSectionId
        ? listingsBySectionId.get(resolvedSectionId)
        : undefined;
      if (!resolvedSectionId || !listing) {
        missingSectionIds.push(course.sectionId);
        return [];
      }
      if (resolvedSectionId !== course.sectionId) {
        sectionIdMigrations.push({
          from: course.sectionId,
          to: resolvedSectionId,
        });
      }
      return [
        coursePlanningListingToWorksheetCourse(
          listing,
          course.color,
          course.hidden,
        ),
      ];
    },
  );

  return {
    courses: courses.sort((a, b) =>
      a.listing.course_code.localeCompare(b.listing.course_code, 'en-US'),
    ),
    missingSectionIds,
    sectionIdMigrations,
  };
}
