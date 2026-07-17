import { getListingId } from './course';
import type { CourseModalPrefetchListingDataFragment } from '../generated/graphql-types';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Crn, Season } from '../queries/graphql-types';

export type CourseModalUrlVariables = {
  seasonCode: Season;
  crn: Crn;
  listingId: number;
};

type StaticCatalogCourses = {
  readonly [seasonCode: string]: {
    readonly data?: Map<Crn, CourseModalPrefetchListingDataFragment>;
    readonly listingsByModalId?: Map<Crn, CoursePlanningListing>;
  };
};

function matchingSeasonCatalog(
  courses: StaticCatalogCourses,
  seasonCode: Season,
) {
  const exact = courses[seasonCode];
  if (exact) return exact;
  const normalizedSeasonCode = seasonCode.toLowerCase();
  return Object.entries(courses).find(
    ([candidate]) => candidate.toLowerCase() === normalizedSeasonCode,
  )?.[1];
}

export function getCoursePlanningCourseFromModalUrl(
  courses: StaticCatalogCourses,
  variables: CourseModalUrlVariables | undefined,
): CoursePlanningListing | undefined {
  if (!variables) return undefined;
  return matchingSeasonCatalog(
    courses,
    variables.seasonCode,
  )?.listingsByModalId?.get(variables.crn);
}

/** Parses `course-modal` query value like `202501-12345` or `FA26-12345`. */
export function parseCourseModalQuery(
  courseModalQuery: string | null,
): CourseModalUrlVariables | undefined {
  const match = /^(?<seasonCode>\w+)-(?<crn>\d+)$/u.exec(
    courseModalQuery ?? '',
  );
  const seasonCode = match?.groups?.seasonCode as Season | undefined;
  const crn = match?.groups?.crn;
  if (!seasonCode || !crn) return undefined;
  const crnNum = Number.parseInt(crn, 10) as Crn;
  return {
    seasonCode,
    crn: crnNum,
    listingId: getListingId(seasonCode, crnNum),
  };
}

/** Numeric season codes belong to the inherited CourseTable/Yale boundary. */
export function isLegacyCourseModalUrl(
  variables: CourseModalUrlVariables | undefined,
): variables is CourseModalUrlVariables {
  return Boolean(variables && Number.isFinite(Number(variables.seasonCode)));
}

export function getStaticCourseFromModalUrl(
  courses: StaticCatalogCourses,
  variables: CourseModalUrlVariables | undefined,
): CourseModalPrefetchListingDataFragment | undefined {
  if (variables === undefined) return undefined;

  return matchingSeasonCatalog(courses, variables.seasonCode)?.data?.get(
    variables.crn,
  );
}
