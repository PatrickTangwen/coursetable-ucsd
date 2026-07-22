import { describe, expect, it } from 'vitest';

import { busiestDay, buildWeeklyLoad } from './worksheetInsights';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';

function createCourse(
  crn: number,
  courseCode: string,
  meetings: { days_of_week: number; start_time: string; end_time: string }[],
) {
  return {
    crn: crn as Crn,
    color: '#123456',
    hidden: false,
    listing: {
      crn: crn as Crn,
      course_code: courseCode,
      course: { course_meetings: meetings },
    },
  } as unknown as WorksheetCourse;
}

describe('worksheet insights', () => {
  it('uses total class time, not meeting count, for the busiest day', () => {
    const courses = [
      createCourse(1, 'MON 1', [
        { days_of_week: 1 << 1, start_time: '09:00', end_time: '09:30' },
      ]),
      createCourse(2, 'MON 2', [
        { days_of_week: 1 << 1, start_time: '10:00', end_time: '10:30' },
      ]),
      createCourse(3, 'TUE 1', [
        { days_of_week: 1 << 2, start_time: '09:00', end_time: '11:00' },
      ]),
    ];

    expect(buildWeeklyLoad(courses).days.map((day) => day.minutes)).toEqual([
      60, 120, 0, 0, 0,
    ]);
    expect(busiestDay(courses)).toEqual({ label: 'Tue', minutes: 120 });
  });
});
