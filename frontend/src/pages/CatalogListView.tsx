import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import CatalogTable from '../components/Catalog/CatalogTable';
import FilterBar, { COURSE_TYPES } from '../components/Catalog/FilterBar';
import { DataLoadErrorPage } from '../components/PageStatus';
import { useCoursePlanningCatalog } from '../hooks/useCoursePlanning';
import { useSearch } from '../hooks/useSearch';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import {
  buildCatalogListFilterCleanup,
  extractCatalogSubjects,
} from '../search/catalogListFilters';
import { useStore } from '../store';
import { createCoursePlanningModalLink } from '../utilities/display';
import styles from './CatalogListView.module.css';

export default function CatalogListView() {
  const { searchData, coursesLoading } = useSearch();
  const { courses, error: courseLoadError } = useCoursePlanningCatalog();
  const typeFilters = useStore((s) => s.catalogTypeFilters);
  const searchFilters = useStore((s) => s.searchFilters);
  const patchSearchFilters = useStore((s) => s.patchSearchFilters);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useStore((s) => s.navigate);

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

  const hasPartialCoverage = searchData?.some(
    ({ catalogCoverage }) =>
      !catalogCoverage.complete || catalogCoverage.continuationNeeded,
  );

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
      {hasPartialCoverage && (
        <output className={styles.coverageWarning}>
          Partial schedule snapshot: the source reports that more data is
          needed, so some sections or meetings may be missing.
        </output>
      )}
      <CatalogTable
        data={filteredData}
        loading={coursesLoading}
        filterBar={<FilterBar subjects={subjects} />}
        onOpenModal={handleOpenModal}
      />
    </div>
  );
}
