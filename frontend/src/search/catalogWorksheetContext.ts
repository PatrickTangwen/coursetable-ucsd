import type { SavedWorksheet } from '../queries/api';
import type { WorksheetCourse } from '../types/worksheetCourse';

export function getCatalogConflictCourses(
  isAnonymousWorksheet: boolean,
  activeSavedWorksheet: SavedWorksheet | undefined,
  activeWorksheetCourses: WorksheetCourse[],
  legacyCourses: WorksheetCourse[],
) {
  return isAnonymousWorksheet || activeSavedWorksheet
    ? activeWorksheetCourses
    : legacyCourses;
}
