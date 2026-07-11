import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import CatalogTable from '../components/Catalog/CatalogTable';
import FilterBar, { COURSE_TYPES } from '../components/Catalog/FilterBar';
import { useFerry } from '../hooks/useFerry';
import { useSearch } from '../hooks/useSearch';
import type { CatalogListing } from '../queries/api';
import {
  buildCatalogListFilterCleanup,
  extractCatalogSubjects,
} from '../search/catalogListFilters';
import { useStore } from '../store';
import styles from './CatalogListView.module.css';

export default function CatalogListView() {
  const { searchData, coursesLoading } = useSearch();
  const { courses } = useFerry();
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

    return searchData.filter((l) => matchers.some((t) => t.matches(l.number)));
  }, [searchData, typeFilters]);

  const handleOpenModal = useCallback(
    (listing: CatalogListing) => {
      navigate('push', { type: 'course', data: listing }, searchParams);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(
          'course-modal',
          `${listing.course.season_code}-${listing.crn}`,
        );
        next.delete('prof-modal');
        return next;
      });
    },
    [navigate, searchParams, setSearchParams],
  );

  return (
    <div className={styles.page}>
      <CatalogTable
        data={filteredData}
        loading={coursesLoading}
        filterBar={<FilterBar subjects={subjects} />}
        onOpenModal={handleOpenModal}
      />
    </div>
  );
}
