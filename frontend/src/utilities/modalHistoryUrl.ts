import { getListingId } from './course';
import type { CourseModalPrefetchListingDataFragment } from '../generated/graphql-types';
import type { Crn, Season } from '../queries/graphql-types';

type CourseModalUrlVariables = {
  seasonCode: Season;
  crn: Crn;
  listingId: number;
};

type StaticCatalogCourses = {
  readonly [seasonCode: string]: {
    readonly data: Map<Crn, CourseModalPrefetchListingDataFragment>;
  };
};

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

export function getStaticCourseFromModalUrl(
  courses: StaticCatalogCourses,
  variables: CourseModalUrlVariables | undefined,
): CourseModalPrefetchListingDataFragment | undefined {
  if (variables === undefined) return undefined;

  const exactSeasonCatalog = courses[variables.seasonCode];
  const exactListing = exactSeasonCatalog?.data.get(variables.crn);
  if (exactListing) return exactListing;

  const normalizedSeasonCode = variables.seasonCode.toLowerCase();
  for (const [seasonCode, catalog] of Object.entries(courses)) {
    if (seasonCode.toLowerCase() !== normalizedSeasonCode) continue;
    const listing = catalog.data.get(variables.crn);
    if (listing) return listing;
  }

  return undefined;
}
