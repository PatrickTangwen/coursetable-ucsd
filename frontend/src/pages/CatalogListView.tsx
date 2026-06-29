import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import CatalogTable from '../components/Catalog/CatalogTable';
import FAB from '../components/Catalog/FAB';
import FilterBar, { COURSE_LEVELS } from '../components/Catalog/FilterBar';
import { useFerry } from '../hooks/useFerry';
import { useSearch } from '../hooks/useSearch';
import type { CatalogListing } from '../queries/api';
import type { Season } from '../queries/graphql-types';
import { buildCatalogListFilterCleanup } from '../search/catalogListFilters';
import type { Option } from '../search/searchTypes';
import { useStore } from '../store';
import styles from './CatalogListView.module.css';

type CatalogCache = ReturnType<typeof useFerry>['courses'];

function extractCatalogSubjects(
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

function parseCourseNumber(code: string): number {
  const match = /\d+/u.exec(code);
  return match ? Number(match[0]) : 0;
}

export default function CatalogListView() {
  const { searchData, coursesLoading } = useSearch();
  const { courses } = useFerry();
  const levelFilter = useStore((s) => s.catalogLevelFilter);
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
    if (!levelFilter) return searchData;

    const level = COURSE_LEVELS.find((l) => l.value === levelFilter);
    if (!level) return searchData;

    return searchData.filter((l) => {
      const num = parseCourseNumber(l.number);
      return num >= level.range[0] && num <= level.range[1];
    });
  }, [searchData, levelFilter]);

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

  if (coursesLoading) {
    return (
      <div className={styles.page}>
        <FilterBar subjects={subjects} />
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: '#8b8fa3',
          }}
        >
          Loading courses...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <FilterBar subjects={subjects} />
      <CatalogTable data={filteredData} onOpenModal={handleOpenModal} />
      <FAB />
    </div>
  );
}
