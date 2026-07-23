import { useEffect } from 'react';

import {
  getCourseData,
  shouldSkipCatalogRequest,
} from '../ferry/ferryCatalogCache';
import type { Season } from '../queries/graphql-types';
import { useStore } from '../store';

/**
 * First load failure among the given seasons. Errors are season-scoped so a
 * failure only surfaces on views that actually requested that season.
 */
export function getSeasonScopedError(
  seasonErrors: { [season: Season]: object },
  requestedSeasons: Season[],
): object | null {
  for (const season of requestedSeasons) {
    const error = seasonErrors[season];
    if (error) return error;
  }
  return null;
}

/**
 * Active UCSD Catalog state. This boundary never exposes GraphQL query hooks.
 */
export function useCoursePlanningCatalog() {
  const requests = useStore((state) => state.ferryRequests);
  const seasonErrors = useStore((state) => state.ferrySeasonErrors);
  useStore((state) => state.ferryCatalogRevision);
  const requestSeasons = useStore((state) => state.requestSeasons);

  const loading = requests !== 0;
  const courses = getCourseData();

  return { requests, loading, seasonErrors, courses, requestSeasons };
}

export function useCoursePlanningRequest(requestedSeasons: Season[]) {
  const { seasonErrors, courses, requestSeasons } = useCoursePlanningCatalog();
  const includeEvals = false;

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

  const error = getSeasonScopedError(seasonErrors, requestedSeasons);
  return { error, courses };
}

export function useCoursePlanningData(requestedSeasons: Season[]) {
  const { error, courses } = useCoursePlanningRequest(requestedSeasons);
  const loading =
    !error &&
    !requestedSeasons.every((season) => Boolean(courses[season]?.catalog));

  return { loading, error, courses };
}
