import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import CatalogTable from '../components/Catalog/CatalogTable';
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
  const levelFilters = useStore((s) => s.catalogLevelFilters);
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
    if (levelFilters.length === 0) return searchData;

    const ranges = COURSE_LEVELS.filter((l) =>
      levelFilters.includes(l.value),
    ).map((l) => l.range);
    if (ranges.length === 0) return searchData;

    return searchData.filter((l) => {
      const num = parseCourseNumber(l.number);
      return ranges.some((range) => num >= range[0] && num <= range[1]);
    });
  }, [searchData, levelFilters]);

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
