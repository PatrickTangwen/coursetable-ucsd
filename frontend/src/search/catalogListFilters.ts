import { defaultFilters } from './searchConstants';
import type { Filters, Option } from './searchTypes';
import type { useFerry } from '../hooks/useFerry';
import type { Season } from '../queries/graphql-types';
import { isEqual } from '../utilities/common';

type CatalogCache = ReturnType<typeof useFerry>['courses'];

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
    for (const listing of catalog.data.values()) set.add(listing.subject);
  }

  const arr = [...set];
  arr.sort();
  return arr;
}

const CATALOG_LIST_VISIBLE_FILTERS = new Set<keyof Filters>([
  'searchText',
  'selectSubjects',
  'selectSeasons',
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
  return CATALOG_LIST_ADVANCED_FILTERS.filter(
    (key) => !isEqual(filters[key], defaultFilters[key]),
  ).length;
}

export function buildCatalogListAdvancedFilterReset(): Partial<Filters> {
  return Object.fromEntries(
    CATALOG_LIST_ADVANCED_FILTERS.map((key) => [key, defaultFilters[key]]),
  ) as Partial<Filters>;
}
