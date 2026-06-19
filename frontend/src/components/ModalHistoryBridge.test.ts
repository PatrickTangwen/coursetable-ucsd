import { describe, expect, it } from 'vitest';

import type { CourseModalPrefetchListingDataFragment } from '../generated/graphql-types';
import type { Crn, Season } from '../queries/graphql-types';
import {
  getStaticCourseFromModalUrl,
  parseCourseModalQuery,
} from '../utilities/modalHistoryUrl';

describe('getStaticCourseFromModalUrl', () => {
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
