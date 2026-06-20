import { useEffect } from 'react';
import { Element } from 'react-scroll';
import 'rc-slider/assets/index.css';

import MobileSearchForm from '../components/Search/MobileSearchForm';
import Results from '../components/Search/Results';
import { useSearch } from '../hooks/useSearch';
import { defaultFilters } from '../search/searchConstants';
import {
  sortByOptions,
  type Filters,
  type SortKeys,
} from '../search/searchTypes';
import { useStore } from '../store';
import { isEqual } from '../utilities/common';
import styles from './Search.module.css';
import './rc-slider-override.css';

const HIDDEN_CATALOG_FILTERS = [
  'overallBounds',
  'workloadBounds',
  'professorBounds',
  'enrollBounds',
  'enableQuist',
] as const satisfies readonly (keyof Filters)[];

const SUPPORTED_CATALOG_SORTS = new Set<SortKeys>([
  'course_code',
  'title',
  'last_modified',
  'added',
  'time',
  'location',
]);

function getCatalogFilterCleanup(filters: Filters): Partial<Filters> {
  const cleanup: Partial<Filters> = {};

  for (const key of HIDDEN_CATALOG_FILTERS) {
    if (!isEqual(filters[key], defaultFilters[key]))
      cleanup[key] = defaultFilters[key] as never;
  }

  if (!SUPPORTED_CATALOG_SORTS.has(filters.selectSortBy.value))
    cleanup.selectSortBy = sortByOptions.course_code;

  return cleanup;
}

function Search() {
  const isMobile = useStore((state) => state.isMobile);
  const searchFilters = useStore((state) => state.searchFilters);
  const patchSearchFilters = useStore((state) => state.patchSearchFilters);
  const { coursesLoading, searchData, multiSeasons } = useSearch();

  useEffect(() => {
    const cleanup = getCatalogFilterCleanup(searchFilters);
    if (Object.keys(cleanup).length) patchSearchFilters(cleanup);
  }, [patchSearchFilters, searchFilters]);

  // TODO: add state if courseLoadError is present
  return (
    <div className={styles.searchBase}>
      {isMobile && <MobileSearchForm />}
      <Element name="catalog" className="d-flex justify-content-center">
        <Results
          data={searchData}
          loading={coursesLoading}
          multiSeasons={multiSeasons}
        />
      </Element>
    </div>
  );
}

export default Search;
