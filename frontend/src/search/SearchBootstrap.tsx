import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import debounce from 'lodash.debounce';
import { buildEvaluator } from 'quist';
import { useShallow } from 'zustand/react/shallow';
import { hasCatalogResultCondition } from './catalogResultVisibility';
import { getCatalogConflictCourses } from './catalogWorksheetContext';
import {
  coursePlanningQueryValue,
  filterCoursePlanningSearchIndex,
  mergeCoursePlanningSearchIndexesForSeasons,
} from './coursePlanningSearch';
import { defaultFilters, SEARCH_FILTER_KEYS } from './searchConstants';
import { getSearchSeasonScope } from './searchSeasonScope';
import type { Filters } from './searchTypes';
import { getLegacyCatalogListing } from '../ferry/ferryCatalogCache';
import { useCoursePlanningData } from '../hooks/useCoursePlanning';
import { useLegacyWorksheetInfo } from '../hooks/useLegacyWorksheetInfo';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { useHydration, useStore } from '../store';
import { anonymousWorksheetHasListing } from '../utilities/anonymousWorksheet';
import { isEqual } from '../utilities/common';
import {
  getNumFriends,
  isInWorksheet,
  shouldHideConflictingListing,
} from '../utilities/course';
import {
  buildCatalogSearchParams,
  getFilterFromParams,
} from '../utilities/params';
import { savedWorksheetHasListing } from '../utilities/savedWorksheet';

type PendingUrlHydration = {
  search: string;
  updates: Partial<Filters>;
};

function hasAppliedHydration(
  searchFilters: Filters,
  updates: Partial<Filters>,
) {
  return (Object.keys(updates) as (keyof Filters)[]).every((key) => {
    const value = updates[key];
    return value === undefined || isEqual(searchFilters[key], value);
  });
}

function useSearchUrlHydration() {
  const location = useLocation();
  const patchSearchFilters = useStore((s) => s.patchSearchFilters);
  const storeHydrated = useHydration();
  const pendingHydrationRef = useRef<PendingUrlHydration | null>(null);
  const clearPendingHydration = useCallback(() => {
    pendingHydrationRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (location.pathname !== '/catalog') return;
    const { searchFilters } = useStore.getState();
    const searchParams = new URLSearchParams(location.search);
    const updates = SEARCH_FILTER_KEYS.reduce<Partial<Filters>>((acc, key) => {
      const urlValue = searchParams.get(key);
      try {
        const next =
          urlValue === null
            ? defaultFilters[key]
            : getFilterFromParams(key, urlValue, defaultFilters[key]);
        if (isEqual(searchFilters[key], next)) return acc;
        return { ...acc, [key]: next };
      } catch {
        return acc;
      }
    }, {});
    if (Object.keys(updates).length > 0) {
      pendingHydrationRef.current = { search: location.search, updates };
      patchSearchFilters(updates);
    } else {
      pendingHydrationRef.current = null;
    }
  }, [location.pathname, location.search, patchSearchFilters, storeHydrated]);

  return { clearPendingHydration, pendingHydrationRef };
}

function useSearchUrlSync(
  pendingHydrationRef: React.RefObject<PendingUrlHydration | null>,
  clearPendingHydration: () => void,
) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const searchFilters = useStore((s) => s.searchFilters);

  useLayoutEffect(() => {
    if (location.pathname !== '/catalog') return;
    const pendingHydration = pendingHydrationRef.current;
    if (
      pendingHydration?.search === location.search &&
      !hasAppliedHydration(searchFilters, pendingHydration.updates)
    )
      return;
    if (pendingHydration?.search === location.search) clearPendingHydration();

    const searchParams = new URLSearchParams(location.search);
    const nextParams = buildCatalogSearchParams(
      searchFilters,
      defaultFilters,
      searchParams,
    );
    const nextSearch = nextParams.toString();
    sessionStorage.setItem(
      'lastCatalogSearch',
      nextSearch ? `?${nextSearch}` : '',
    );
    if (nextSearch === searchParams.toString()) return;

    setSearchParams(nextParams);
  }, [
    clearPendingHydration,
    location.pathname,
    location.search,
    pendingHydrationRef,
    searchFilters,
    setSearchParams,
  ]);
}

const targetTypes = {
  categorical: new Set([
    'school',
    'season',
    'type',
    'subject',
    'course-code',
  ] as const),
  numeric: new Set([
    'rating',
    'workload',
    'professor-rating',
    'number',
    'enrollment',
    'credits',
  ] as const),
  set: new Set([
    'skills',
    'areas',
    'days',
    'info-attributes',
    'subjects',
    'professor-names',
    'building-codes',
    'listings.subjects',
    'listings.course-codes',
    'listings.schools',
  ] as const),
  boolean: new Set([
    'cancelled',
    'conflicting',
    'grad',
    'discussion',
    'fysem',
    'colsem',
  ] as const),
  text: new Set([
    'title',
    'description',
    'location',
    'added',
    'last_modified',
  ] as const),
};

export function SearchBootstrap({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const { clearPendingHydration, pendingHydrationRef } =
    useSearchUrlHydration();
  useSearchUrlSync(pendingHydrationRef, clearPendingHydration);

  const setSearchData = useStore((s) => s.setSearchData);
  const searchData = useStore((s) => s.searchData);
  const searchFilters = useStore((s) => s.searchFilters);
  const searchTimingStartMs = useStore((s) => s.searchTimingStartMs);
  const catalogTypeFilters = useStore((s) => s.catalogTypeFilters);
  const catalogResultsEnabled = hasCatalogResultCondition(
    searchFilters,
    catalogTypeFilters,
  );
  const {
    worksheets,
    friends,
    sameCourseIdToCrns,
    getRelevantWorksheetNumber,
    isAnonymousWorksheet,
    anonymousWorksheet,
    activeSavedWorksheet,
    activeWorksheetCourses,
    crossTermSavedSections,
  } = useStore(
    useShallow((state) => ({
      worksheets: state.worksheets,
      friends: state.friends,
      sameCourseIdToCrns: state.sameCourseIdToCrns,
      getRelevantWorksheetNumber: state.getRelevantWorksheetNumber,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeWorksheetCourses: state.courses,
      crossTermSavedSections: state.crossTermSavedSections,
    })),
  );

  const processedSeasons = useMemo(
    () =>
      getSearchSeasonScope(searchFilters.selectSeasons, catalogResultsEnabled),
    [catalogResultsEnabled, searchFilters.selectSeasons],
  );
  const {
    loading: coursesLoading,
    courses: courseData,
    error: courseLoadError,
  } = useCoursePlanningData(processedSeasons);
  const { data: legacyWorksheetInfo } = useLegacyWorksheetInfo(
    worksheets,
    processedSeasons,
    getRelevantWorksheetNumber,
  );
  const numFriends = useMemo(
    () => (friends ? getNumFriends(friends, sameCourseIdToCrns) : {}),
    [friends, sameCourseIdToCrns],
  );

  const legacyListing = useCallback(
    (listing: CoursePlanningListing) =>
      getLegacyCatalogListing(
        listing.section.supportedTerm as Season,
        listing.section.sectionId,
      ),
    [],
  );
  const isListingInActiveWorksheet = useCallback(
    (listing: CoursePlanningListing) => {
      if (isAnonymousWorksheet)
        return anonymousWorksheetHasListing(anonymousWorksheet, listing);
      if (activeSavedWorksheet) {
        return savedWorksheetHasListing(
          activeSavedWorksheet,
          crossTermSavedSections,
          listing,
        );
      }
      const legacy = legacyListing(listing);
      return legacy
        ? isInWorksheet(
            legacy,
            getRelevantWorksheetNumber(legacy.course.season_code),
            worksheets,
          )
        : false;
    },
    [
      activeSavedWorksheet,
      anonymousWorksheet,
      crossTermSavedSections,
      getRelevantWorksheetNumber,
      isAnonymousWorksheet,
      legacyListing,
      worksheets,
    ],
  );
  const isConflicting = useCallback(
    (listing: CoursePlanningListing) => {
      const legacy = legacyListing(listing);
      const worksheetInfo = getCatalogConflictCourses(
        isAnonymousWorksheet,
        activeSavedWorksheet,
        activeWorksheetCourses,
        legacyWorksheetInfo,
      );
      return legacy
        ? shouldHideConflictingListing(
            worksheetInfo,
            legacy,
            isListingInActiveWorksheet(listing),
          )
        : false;
    },
    [
      activeSavedWorksheet,
      activeWorksheetCourses,
      isAnonymousWorksheet,
      isListingInActiveWorksheet,
      legacyListing,
      legacyWorksheetInfo,
    ],
  );
  const queryEvaluator = useMemo(
    () =>
      buildEvaluator(targetTypes, (listing: CoursePlanningListing, key) => {
        const value = coursePlanningQueryValue(listing, key, isConflicting);
        if (
          key === '*' &&
          searchFilters.searchDescription &&
          listing.course.description
        )
          return `${String(value)} ${listing.course.description}`;
        return value;
      }),
    [isConflicting, searchFilters.searchDescription],
  );
  const quistPredicate = useMemo(() => {
    if (!searchFilters.enableQuist) return undefined;
    try {
      return queryEvaluator(searchFilters.searchText);
    } catch {
      Sentry.addBreadcrumb({
        category: 'quist',
        message: `Parsing quist query "${searchFilters.searchText}"`,
        level: 'info',
      });
      Sentry.captureException(new Error('Quist query failed to parse'));
      return undefined;
    }
  }, [queryEvaluator, searchFilters.enableQuist, searchFilters.searchText]);

  const catalogSearchIndex = useMemo(
    () =>
      mergeCoursePlanningSearchIndexesForSeasons(
        processedSeasons,
        (season) => courseData[season]?.searchIndex,
      ),
    [courseData, processedSeasons],
  );

  const updateSearchData = useCallback(() => {
    if (!catalogResultsEnabled) {
      setSearchData([]);
      return;
    }
    setSearchData(
      filterCoursePlanningSearchIndex(catalogSearchIndex, searchFilters, {
        isConflicting,
        quistPredicate,
      }),
    );
  }, [
    catalogSearchIndex,
    catalogResultsEnabled,
    isConflicting,
    quistPredicate,
    searchFilters,
    setSearchData,
  ]);
  const updateSearchDataDebounced = useMemo(
    () => debounce(updateSearchData, 300, { leading: true, trailing: true }),
    [updateSearchData],
  );

  useEffect(() => {
    if (coursesLoading || courseLoadError) return undefined;
    updateSearchDataDebounced();
    return () => updateSearchDataDebounced.cancel();
  }, [courseLoadError, coursesLoading, updateSearchDataDebounced]);

  useLayoutEffect(() => {
    useStore.getState().setSearchNumFriends(numFriends);
  }, [numFriends]);
  useLayoutEffect(() => {
    useStore.getState().setSearchMultiSeasons(processedSeasons.length !== 1);
  }, [processedSeasons.length]);
  useLayoutEffect(() => {
    useStore.getState().setSearchCoursesLoading(coursesLoading);
  }, [coursesLoading]);
  useEffect(() => {
    if (!coursesLoading) {
      const duration = Math.abs(Date.now() - searchTimingStartMs) / 1000;
      useStore.getState().setSearchDuration(duration);
    }
  }, [coursesLoading, searchData, searchFilters, searchTimingStartMs]);

  return <>{children}</>;
}
