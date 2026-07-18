import { useEffect } from 'react';

import {
  getCourseData,
  shouldSkipCatalogRequest,
} from '../ferry/ferryCatalogCache';
import type { Season } from '../queries/graphql-types';
import { useStore } from '../store';

/**
 * Active UCSD Catalog state. This boundary never exposes GraphQL query hooks.
 */
export function useCoursePlanningCatalog() {
  const requests = useStore((state) => state.ferryRequests);
  const errors = useStore((state) => state.ferryErrors);
  useStore((state) => state.ferryCatalogRevision);
  const requestSeasons = useStore((state) => state.requestSeasons);

  const error = errors[0] ?? null;
  const loading = requests !== 0 && !error;
  const courses = getCourseData();

  return { requests, loading, error, courses, requestSeasons };
}

export function useCoursePlanningRequest(requestedSeasons: Season[]) {
  const authStatus = useStore((state) => state.authStatus);
  const userHasEvals = useStore((state) => state.user?.hasEvals);
  const { error, courses, requestSeasons } = useCoursePlanningCatalog();
  const includeEvals = Boolean(authStatus === 'authenticated' && userHasEvals);

  useEffect(() => {
    if (
      requestedSeasons.length === 0 ||
      requestedSeasons.every((season) =>
        shouldSkipCatalogRequest(season, includeEvals),
      )
    )
      return;
    void requestSeasons(requestedSeasons);
  }, [includeEvals, requestSeasons, requestedSeasons]);

  return { error, courses };
}

export function useCoursePlanningData(requestedSeasons: Season[]) {
  const { error, courses } = useCoursePlanningRequest(requestedSeasons);
  const loading =
    !error &&
    !requestedSeasons.every((season) => Boolean(courses[season]?.catalog));

  return { loading, error, courses };
}
