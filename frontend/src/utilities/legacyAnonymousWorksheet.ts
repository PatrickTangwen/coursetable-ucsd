import {
  ANONYMOUS_WORKSHEET_NAME,
  getAnonymousWorksheetCourses,
  getListingSectionId,
  type AnonymousWorksheetState,
} from './anonymousWorksheet';
import type { CatalogListing, UserWorksheets } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';

/**
 * Resolves inherited Saved/legacy Worksheet data until issue #165 migrates it.
 */
export function resolveLegacyWorksheet(
  worksheet: AnonymousWorksheetState,
  catalog: Map<Crn, CatalogListing> | undefined,
  term: Season = worksheet.term,
): { worksheets: UserWorksheets; missingSectionIds: string[] } {
  type Worksheet =
    UserWorksheets extends Map<Season, Map<number, infer W>> ? W : never;
  const seasonWorksheets = new Map<number, Worksheet>();
  const worksheets: UserWorksheets = new Map([[term, seasonWorksheets]]);

  if (!catalog) {
    seasonWorksheets.set(0, {
      name: ANONYMOUS_WORKSHEET_NAME,
      private: false,
      courses: [],
    });
    return { worksheets, missingSectionIds: [] };
  }

  const listingsBySectionId = new Map<string, CatalogListing>();
  for (const listing of catalog.values()) {
    const sectionId = getListingSectionId(listing);
    if (sectionId) listingsBySectionId.set(sectionId, listing);
  }

  const missingSectionIds: string[] = [];
  const courses = getAnonymousWorksheetCourses(worksheet, term).flatMap(
    (course) => {
      const listing = listingsBySectionId.get(course.sectionId);
      if (!listing) {
        missingSectionIds.push(course.sectionId);
        return [];
      }
      return [
        {
          crn: listing.crn,
          color: course.color,
          hidden: course.hidden,
          sameCourseId: listing.course.same_course_id,
        },
      ];
    },
  );

  seasonWorksheets.set(0, {
    name: ANONYMOUS_WORKSHEET_NAME,
    private: false,
    courses,
  });

  return { worksheets, missingSectionIds };
}
