import { describe, expect, it } from 'vitest';

import { getUcsdSnapshotCourseDetails } from './ucsdSnapshotCourse';
import type { CourseModalPrefetchListingDataFragment } from '../../generated/graphql-types';
import type { Crn, Season } from '../../queries/graphql-types';

function listing(
  course: Partial<CourseModalPrefetchListingDataFragment['course']>,
) {
  return {
    crn: 123 as Crn,
    course_code: 'CSE 1',
    course: {
      season_code: '202501' as Season,
      section: '01',
      title: 'Course',
      skills: [],
      areas: [],
      extra_info: 'ACTIVE',
      description: null,
      same_course_id: 1,
      primary_crn: 123 as Crn,
      listings: [{ crn: 123 as Crn, course_code: 'CSE 1' }],
      course_professors: [],
      course_meetings: [],
      ...course,
    },
  } as CourseModalPrefetchListingDataFragment;
}

describe('getUcsdSnapshotCourseDetails', () => {
  it('keeps nonnumeric UCSD snapshot terms out of inherited modal UI when archive metadata is missing', () => {
    const result = getUcsdSnapshotCourseDetails(
      listing({ season_code: 'FA26' as Season }),
    );

    expect(result.archive).toBeNull();
    expect(result.isUcsdSnapshotCourse).toBe(true);
  });

  it('recognizes UCSD runtime metadata even when archive parsing fails', () => {
    const result = getUcsdSnapshotCourseDetails(
      listing({
        ucsd_calendar: {},
        ucsd_archive: null,
      } as Partial<CourseModalPrefetchListingDataFragment['course']>),
    );

    expect(result.archive).toBeNull();
    expect(result.isUcsdSnapshotCourse).toBe(true);
  });

  it('leaves numeric inherited CourseTable terms on the inherited modal path', () => {
    expect(getUcsdSnapshotCourseDetails(listing({}))).toEqual({
      archive: null,
      isUcsdSnapshotCourse: false,
    });
  });
});
