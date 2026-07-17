import { describe, expect, it } from 'vitest';

import type { CourseModalPrefetchListingDataFragment } from '../generated/graphql-types';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Crn, Season } from '../queries/graphql-types';
import {
  getStaticCourseFromModalUrl,
  getCoursePlanningCourseFromModalUrl,
  isLegacyCourseModalUrl,
  parseCourseModalQuery,
} from '../utilities/modalHistoryUrl';

describe('getStaticCourseFromModalUrl', () => {
  it('restores an owned Course Planning listing from a pre-refactor modal link', () => {
    const listing = {
      section: {
        supportedTerm: 'FA26',
        sectionId: 'FA26:123456',
      },
    } as CoursePlanningListing;
    // Literal captured from the pre-refactor generated link identity.
    const modalId = 1939050985 as Crn;
    const courses = {
      fa26: {
        listingsByModalId: new Map([[modalId, listing]]),
      },
    };

    expect(
      getCoursePlanningCourseFromModalUrl(
        courses,
        parseCourseModalQuery(`FA26-${modalId}`),
      ),
    ).toBe(listing);
  });

  it('keeps UCSD deep links out of the inherited GraphQL hydrator', () => {
    expect(
      isLegacyCourseModalUrl(parseCourseModalQuery('FA26-1939050985')),
    ).toBe(false);
    expect(isLegacyCourseModalUrl(parseCourseModalQuery('202501-12345'))).toBe(
      true,
    );
  });

  it('finds UCSD static catalog listings when URL and cache season casing differ', () => {
    const listing = {
      crn: 1804430517 as Crn,
      course: {
        season_code: 'FA26' as Season,
      },
    } as CourseModalPrefetchListingDataFragment;

    const courses = {
      fa26: {
        data: new Map([[listing.crn, listing]]),
      },
    };

    expect(
      getStaticCourseFromModalUrl(
        courses,
        parseCourseModalQuery('FA26-1804430517'),
      ),
    ).toBe(listing);
  });
});
