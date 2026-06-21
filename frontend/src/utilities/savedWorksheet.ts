import type { AnonymousWorksheetState } from './anonymousWorksheet';
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

export function buildSaveAnonymousWorksheetPayload(
  name: string,
  worksheet: AnonymousWorksheetState,
) {
  return {
    name: name.trim(),
    term: worksheet.term,
    courses: worksheet.courses.map((course) => ({
      sectionId: course.sectionId,
      color: course.color,
      hidden: course.hidden,
    })),
  };
}
