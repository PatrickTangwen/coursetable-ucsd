import { catalogUnitValues, formatCatalogUnitLabel } from './catalogUnits';
import { defaultFilters } from './searchConstants';
import type { Filters, Option } from './searchTypes';
import type { useCoursePlanningCatalog } from '../hooks/useCoursePlanning';
import type { Season } from '../queries/graphql-types';
import { isEqual } from '../utilities/common';

type CatalogCache = ReturnType<typeof useCoursePlanningCatalog>['courses'];

export function extractCatalogSubjects(
  courses: CatalogCache,
  selectedSeasons: Option<Season>[],
): string[] {
  const set = new Set<string>();
  const seasonCodes =
    selectedSeasons.length === 0
      ? (Object.keys(courses) as Season[])
      : selectedSeasons.map((season) => season.value);

  for (const seasonCode of seasonCodes) {
    const catalog = courses[seasonCode];
    if (!catalog) continue;
    for (const listing of catalog.listings.values())
      set.add(listing.course.subject);
  }

  const arr = [...set];
  arr.sort();
  return arr;
}

export function extractCatalogUnitOptions(
  courses: CatalogCache,
  selectedSeasons: Option<Season>[],
): Option<number>[] {
  const values = new Set<number>();
  const seasonCodes =
    selectedSeasons.length === 0
      ? (Object.keys(courses) as Season[])
      : selectedSeasons.map((season) => season.value);

  for (const seasonCode of seasonCodes) {
    const catalog = courses[seasonCode];
    if (!catalog) continue;
    for (const listing of catalog.listings.values()) {
      for (const value of catalogUnitValues(listing.course.units))
        values.add(value);
    }
  }

  return [...values]
    .toSorted((a, b) => a - b)
    .map((value) => ({ value, label: formatCatalogUnitLabel(value) }));
}

const CATALOG_LIST_VISIBLE_FILTERS = new Set<keyof Filters>([
  'searchText',
  'searchColumn',
  'selectSubjects',
  'selectSeasons',
  'selectDays',
  'selectCredits',
]);

const CATALOG_LIST_ADVANCED_FILTERS = (
  Object.keys(defaultFilters) as (keyof Filters)[]
).filter((key) => !CATALOG_LIST_VISIBLE_FILTERS.has(key));

export function buildCatalogListFilterCleanup(
  filters: Filters,
): Partial<Filters> {
  const cleanup: Partial<Filters> = {};

  for (const key of Object.keys(defaultFilters) as (keyof Filters)[]) {
    if (CATALOG_LIST_VISIBLE_FILTERS.has(key)) continue;
    if (CATALOG_LIST_ADVANCED_FILTERS.includes(key)) continue;

    if (!isEqual(filters[key], defaultFilters[key]))
      cleanup[key] = defaultFilters[key] as never;
  }

  return cleanup;
}

export function countCatalogListAdvancedFilters(filters: Filters): number {
  return getActiveCatalogListAdvancedFilterKeys(filters).length;
}

export function getActiveCatalogListAdvancedFilterKeys(
  filters: Filters,
): (keyof Filters)[] {
  return CATALOG_LIST_ADVANCED_FILTERS.filter(
    (key) => !isEqual(filters[key], defaultFilters[key]),
  );
}

export function buildCatalogListAdvancedFilterReset(
  keys: (keyof Filters)[] = CATALOG_LIST_ADVANCED_FILTERS,
): Partial<Filters> {
  return Object.fromEntries(
    keys.map((key) => [key, defaultFilters[key]]),
  ) as Partial<Filters>;
}
