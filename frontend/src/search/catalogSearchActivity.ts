import { defaultFilters } from './searchConstants';
import type { Filters } from './searchTypes';
import { isEqual } from '../utilities/common';

const courseSearchFilterKeys = [
  'selectSubjects',
  'selectSkillsAreas',
  'overallBounds',
  'workloadBounds',
  'professorBounds',
  'selectSeasons',
  'selectDays',
  'timeBounds',
  'enrollBounds',
  'numBounds',
  'selectSchools',
  'selectCredits',
  'selectCourseInfoAttributes',
  'selectBuilding',
  'hideCancelled',
  'hideConflicting',
  'includeAttributes',
  'excludeAttributes',
] as const satisfies readonly (keyof Filters)[];

export function hasCatalogSearchCondition(
  filters: Filters,
  typeFilters: readonly string[],
): boolean {
  return (
    filters.searchText.trim().length > 0 ||
    typeFilters.length > 0 ||
    courseSearchFilterKeys.some(
      (key) => !isEqual(filters[key], defaultFilters[key]),
    )
  );
}
