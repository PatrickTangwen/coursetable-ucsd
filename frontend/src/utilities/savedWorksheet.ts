import {
  getAnonymousWorksheetCourses,
  normalizeAnonymousWorksheet,
  resolveAnonymousWorksheetCourses,
  type AnonymousWorksheetState,
} from './anonymousWorksheet';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';

export type SavedWorksheetAuthStatus =
  | 'loading'
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated';

export function getDefaultSavedWorksheetName(term: Season) {
  return `${term} Worksheet`;
}

export function canSaveAnonymousWorksheet(
  authStatus: SavedWorksheetAuthStatus,
) {
  return authStatus === 'authenticated';
}

export function canRestoreSavedWorksheet(authStatus: SavedWorksheetAuthStatus) {
  return authStatus === 'authenticated';
}

export function buildSaveAnonymousWorksheetPayload(
  name: string,
  worksheet: AnonymousWorksheetState,
) {
  return {
    name: name.trim(),
    term: worksheet.term,
    courses: getAnonymousWorksheetCourses(worksheet).map((course) => ({
      sectionId: course.sectionId,
      color: course.color,
      hidden: course.hidden,
    })),
  };
}

export type SavedWorksheetRestoreSource = {
  id?: number;
  name?: string;
  term: string;
  createdAt?: number;
  updatedAt?: number;
  private?: boolean;
  sourceSectionCount?: number;
  savedSectionCount?: number;
  sections: {
    sectionId: string;
    color: string;
    hidden: boolean;
  }[];
};

export function buildRestoredAnonymousWorksheet(
  worksheet: SavedWorksheetRestoreSource,
): AnonymousWorksheetState {
  const term = worksheet.term as Season;
  return normalizeAnonymousWorksheet(
    {
      term,
      courses: worksheet.sections.map((section) => ({
        sectionId: section.sectionId,
        color: section.color,
        hidden: section.hidden,
      })),
    },
    term,
  );
}

export function resolveSavedWorksheetCourses(
  worksheet: SavedWorksheetRestoreSource,
  listingsBySectionId: Map<string, CoursePlanningListing> | undefined,
) {
  const restoredWorksheet = buildRestoredAnonymousWorksheet(worksheet);
  return resolveAnonymousWorksheetCourses(
    restoredWorksheet,
    listingsBySectionId,
    restoredWorksheet.term,
  );
}
