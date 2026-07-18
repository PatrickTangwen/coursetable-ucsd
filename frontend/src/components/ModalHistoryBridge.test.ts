import { describe, expect, it } from 'vitest';

import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Crn } from '../queries/graphql-types';
import { isLegacyCourseModalUrl } from '../utilities/legacyCourseModalUrl';
import {
  getCoursePlanningCourseFromModalUrl,
  parseCourseModalQuery,
} from '../utilities/modalHistoryUrl';

describe('Course modal URL restoration', () => {
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
});
