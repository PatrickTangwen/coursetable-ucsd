import { describe, expect, it } from 'vitest';
import {
  describeConflictSlot,
  getOccurrenceConflicts,
  getScheduleConflicts,
  groupConflictsByCrn,
  summarizeConflictPairs,
} from './scheduleConflicts';
import type { CatalogListing } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';
import type { WorksheetCourse } from '../types/worksheetCourse';

type Meeting = {
  days_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  date?: string | null;
  meeting_type?: string | null;
};

const dayMask = (...days: number[]) =>
  days.reduce((mask, day) => mask | (1 << day), 0);

function makeCourse({
  courseCode,
  crn,
  meetings,
  season = 'FA26' as Season,
}: {
  courseCode: string;
  crn: number;
  meetings: Meeting[];
  season?: Season;
}): WorksheetCourse {
  const [subject = 'CSE', number = '1'] = courseCode.split(' ');
  const listing = {
    crn: crn as Crn,
    course_code: courseCode,
    number,
    school: 'UCSD',
    subject,
    course: {
      season_code: season,
      title: `${courseCode} title`,
      section: 'A00',
      course_meetings: meetings,
      listings: [
        {
          crn: crn as Crn,
          course_code: courseCode,
          school: 'UCSD',
          subject,
        },
      ],
    },
  } as unknown as CatalogListing;
  return {
    crn: listing.crn,
    color: '#123456',
    listing,
    hidden: false,
  };
}

describe('getScheduleConflicts', () => {
  it('detects overlapping weekly meetings on shared days', () => {
    const conflicts = getScheduleConflicts([
      makeCourse({
        courseCode: 'CSE 100',
        crn: 101,
        meetings: [
          {
            days_of_week: dayMask(2, 4),
            start_time: '09:30',
            end_time: '10:50',
          },
        ],
      }),
      makeCourse({
        courseCode: 'MATH 20C',
        crn: 202,
        meetings: [
          { days_of_week: dayMask(4), start_time: '10:00', end_time: '10:50' },
        ],
      }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.sharedDays).toBe(dayMask(4));
    expect(conflicts[0]!.date).toBeNull();
    expect(conflicts[0]!.overlapStartMin).toBe(10 * 60);
    expect(conflicts[0]!.overlapEndMin).toBe(10 * 60 + 50);
  });

  it('ignores weekly meetings without shared days or overlap', () => {
    const conflicts = getScheduleConflicts([
      makeCourse({
        courseCode: 'CSE 100',
        crn: 101,
        meetings: [
          { days_of_week: dayMask(1), start_time: '09:00', end_time: '09:50' },
          { days_of_week: dayMask(3), start_time: '09:00', end_time: '09:50' },
        ],
      }),
      makeCourse({
        courseCode: 'MATH 20C',
        crn: 202,
        meetings: [
          { days_of_week: dayMask(1), start_time: '09:50', end_time: '10:40' },
          { days_of_week: dayMask(2), start_time: '09:00', end_time: '09:50' },
        ],
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('detects dated meetings that overlap on the same date only', () => {
    const conflicts = getScheduleConflicts([
      makeCourse({
        courseCode: 'CSE 100',
        crn: 101,
        meetings: [
          {
            days_of_week: 0,
            start_time: '15:00',
            end_time: '17:59',
            date: '2026-12-09',
            meeting_type: 'Final',
          },
        ],
      }),
      makeCourse({
        courseCode: 'MATH 20C',
        crn: 202,
        meetings: [
          {
            days_of_week: 0,
            start_time: '16:00',
            end_time: '18:59',
            date: '2026-12-09',
            meeting_type: 'Final',
          },
        ],
      }),
      makeCourse({
        courseCode: 'PHYS 2A',
        crn: 303,
        meetings: [
          {
            days_of_week: 0,
            start_time: '15:00',
            end_time: '17:59',
            date: '2026-12-10',
            meeting_type: 'Final',
          },
        ],
      }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.date).toBe('2026-12-09');
    expect(conflicts[0]!.a.meetingType).toBe('Final');
  });

  it('never conflicts a dated exam with a weekly meeting', () => {
    // 2026-12-09 is a Wednesday; the weekly meeting also covers Wednesday.
    const conflicts = getScheduleConflicts([
      makeCourse({
        courseCode: 'CSE 100',
        crn: 101,
        meetings: [
          {
            days_of_week: dayMask(3),
            start_time: '15:00',
            end_time: '17:59',
            date: '2026-12-09',
            meeting_type: 'Final',
          },
        ],
      }),
      makeCourse({
        courseCode: 'MATH 20C',
        crn: 202,
        meetings: [
          { days_of_week: dayMask(3), start_time: '15:00', end_time: '15:50' },
        ],
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('skips TBA meetings and identical crns', () => {
    const sharedCourse = makeCourse({
      courseCode: 'CSE 100',
      crn: 101,
      meetings: [
        { days_of_week: dayMask(2), start_time: '09:00', end_time: '09:50' },
      ],
    });
    const conflicts = getScheduleConflicts([
      sharedCourse,
      { ...sharedCourse },
      makeCourse({
        courseCode: 'CSE 99',
        crn: 303,
        meetings: [{ days_of_week: dayMask(2) }],
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe('conflict grouping and formatting', () => {
  const courses = [
    makeCourse({
      courseCode: 'CSE 100',
      crn: 101,
      meetings: [
        { days_of_week: dayMask(2, 4), start_time: '09:30', end_time: '10:50' },
      ],
    }),
    makeCourse({
      courseCode: 'MATH 20C',
      crn: 202,
      meetings: [
        {
          days_of_week: dayMask(2, 4),
          start_time: '10:00',
          end_time: '10:50',
          meeting_type: 'Lecture',
        },
      ],
    }),
  ];
  const conflicts = getScheduleConflicts(courses);

  it('orients conflicts around each course', () => {
    const byCrn = groupConflictsByCrn(conflicts);
    expect(byCrn.get(101 as Crn)![0]!.own.courseCode).toBe('CSE 100');
    expect(byCrn.get(101 as Crn)![0]!.other.courseCode).toBe('MATH 20C');
    expect(byCrn.get(202 as Crn)![0]!.own.courseCode).toBe('MATH 20C');
  });

  it('matches calendar occurrences by day and time', () => {
    const courseConflicts = groupConflictsByCrn(conflicts).get(101 as Crn)!;
    expect(
      getOccurrenceConflicts(courseConflicts, {
        day: 4,
        startMin: 9 * 60 + 30,
        endMin: 10 * 60 + 50,
        date: null,
      }),
    ).toHaveLength(1);
    expect(
      getOccurrenceConflicts(courseConflicts, {
        day: 1,
        startMin: 9 * 60 + 30,
        endMin: 10 * 60 + 50,
        date: null,
      }),
    ).toHaveLength(0);
  });

  it('formats slots and pair summaries', () => {
    expect(describeConflictSlot(conflicts[0]!)).toBe('Tu Th · 10 – 10:50 AM');
    const pairs = summarizeConflictPairs(conflicts);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.courseCodes).toEqual(['CSE 100', 'MATH 20C']);
    expect(pairs[0]!.details).toEqual(['Tu Th · 10 – 10:50 AM']);
  });
});
