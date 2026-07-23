import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import CatalogDisclaimer from '../components/Catalog/CatalogDisclaimer';
import CatalogTable from '../components/Catalog/CatalogTable';
import FilterBar, { COURSE_TYPES } from '../components/Catalog/FilterBar';
import { DataLoadErrorPage } from '../components/PageStatus';
import { CUR_SEASON } from '../config';
import {
  getSeasonScopedError,
  useCoursePlanningCatalog,
  useCoursePlanningRequest,
} from '../hooks/useCoursePlanning';
import { useSearch } from '../hooks/useSearch';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import {
  buildCatalogListFilterCleanup,
  extractCatalogSubjects,
} from '../search/catalogListFilters';
import { hasCatalogResultCondition } from '../search/catalogResultVisibility';
import { getSearchSeasonScope } from '../search/searchSeasonScope';
import { useStore } from '../store';
import { createCoursePlanningModalLink } from '../utilities/display';
import styles from './CatalogListView.module.css';

export default function CatalogListView() {
  const { searchData, coursesLoading } = useSearch();
  const { courses, seasonErrors } = useCoursePlanningCatalog();
  const typeFilters = useStore((s) => s.catalogTypeFilters);
  const searchFilters = useStore((s) => s.searchFilters);
  const patchSearchFilters = useStore((s) => s.patchSearchFilters);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useStore((s) => s.navigate);
  const resultsEnabled = hasCatalogResultCondition(searchFilters, typeFilters);
  // The Catalog page renders results from the selected terms, so it loads
  // their catalogs as soon as it mounts — even while idle, so the first
  // search resolves instantly. Errors only surface once results are shown.
  const selectedSeasons = useMemo(
    () =>
      searchFilters.selectSeasons.length > 0
        ? searchFilters.selectSeasons.map((season) => season.value)
        : [CUR_SEASON],
    [searchFilters.selectSeasons],
  );
  useCoursePlanningRequest(selectedSeasons);
  const courseLoadError = getSeasonScopedError(
    seasonErrors,
    getSearchSeasonScope(searchFilters.selectSeasons, resultsEnabled),
  );

  const subjects = useMemo(
    () => extractCatalogSubjects(courses, searchFilters.selectSeasons),
    [courses, searchFilters.selectSeasons],
  );

  useEffect(() => {
    const cleanup = buildCatalogListFilterCleanup(searchFilters);
    if (Object.keys(cleanup).length > 0) patchSearchFilters(cleanup);
  }, [patchSearchFilters, searchFilters]);

  const filteredData = useMemo(() => {
    if (!searchData) return null;
    if (typeFilters.length === 0) return searchData;

    const matchers = COURSE_TYPES.filter((t) => typeFilters.includes(t.value));
    if (matchers.length === 0) return searchData;

    return searchData.filter((listing) =>
      matchers.some((type) => type.matches(listing.course.courseNumber)),
    );
  }, [searchData, typeFilters]);

  const handleOpenModal = useCallback(
    (listing: CoursePlanningListing) => {
      navigate(
        'push',
        { type: 'course-planning', data: listing },
        searchParams,
      );
      setSearchParams((prev) => {
        const link = createCoursePlanningModalLink(listing, prev);
        return new URLSearchParams(link.slice(1));
      });
    },
    [navigate, searchParams, setSearchParams],
  );

  if (courseLoadError) return <DataLoadErrorPage />;

  return (
    <div className={styles.page}>
      <CatalogDisclaimer />
      <CatalogTable
        data={filteredData}
        loading={coursesLoading}
        resultsEnabled={resultsEnabled}
        filterBar={<FilterBar subjects={subjects} />}
        onOpenModal={handleOpenModal}
      />
    </div>
  );
}
