import { useCoursePlanningRequest } from './useCoursePlanning';
import type { Season } from '../queries/graphql-types';

/**
 * Inherited CourseTable/Yale Catalog resolver. UCSD uses useCoursePlanning.
 */
export function useLegacyCourseData(requestedSeasons: Season[]) {
  const { error, courses } = useCoursePlanningRequest(requestedSeasons);
  const loading =
    !error && !requestedSeasons.every((season) => courses[season]);

  return { loading, error, courses };
}
