import { defaultFilters } from './searchConstants';
import type { Filters } from './searchTypes';
import { isEqual } from '../utilities/common';

const CATALOG_LIST_VISIBLE_FILTERS = new Set<keyof Filters>([
  'searchText',
  'selectSubjects',
]);

export function buildCatalogListFilterCleanup(
  filters: Filters,
): Partial<Filters> {
  const cleanup: Partial<Filters> = {};

  for (const key of Object.keys(defaultFilters) as (keyof Filters)[]) {
    if (CATALOG_LIST_VISIBLE_FILTERS.has(key)) continue;

    if (!isEqual(filters[key], defaultFilters[key]))
      cleanup[key] = defaultFilters[key] as never;
  }

  return cleanup;
}
