import { describe, expect, it } from 'vitest';
import { formatSkippedMeetingsSummary, getCalendarExport } from './calendar';
import type { CatalogListing } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';
import type { WorksheetCourse } from '../types/worksheetCourse';

const dayMask = (...days: number[]) =>
  days.reduce((mask, day) => mask | (1 << day), 0);

type Meeting = {
  date?: string | null;
  days_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  meeting_type?: string | null;
  location?: {
    room: string | null;
    building: {
      code: string;
    };
  } | null;
  raw_location?: string | null;
};

type SourceMeeting = {
  days: string[];
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  is_tba: boolean;
  raw_days: string | null;
  raw_time: string | null;
  raw_location: string | null;
};

function makeListing({
  courseCode,
  crn,
  section = 'A00',
  meetingType = 'Lecture',
  title = `${courseCode} title`,
  professors = ['Ada Lovelace'],
  meetings,
  sourceMeetings = [],
  season = 'FA26' as Season,
}: {
  courseCode: string;
  crn: number;
  section?: string;
  meetingType?: string | null;
  title?: string;
  professors?: string[];
  meetings: Meeting[];
  sourceMeetings?: SourceMeeting[];
  season?: Season;
}): CatalogListing {
  const [subject = 'CSE', number = '1'] = courseCode.split(' ');
  return {
    crn: crn as Crn,
    course_code: courseCode,
    number,
    school: 'UCSD',
    subject,
    section_id: `${season}:${subject}-${crn}`,
    course: {
      season_code: season,
      title,
      section,
      course_meetings: meetings,
      course_professors: professors.map((name, index) => ({
        professor: {
          professor_id: index,
          name,
        },
      })),
      listings: [
        {
          crn: crn as Crn,
          course_code: courseCode,
          school: 'UCSD',
          subject,
          section_id: `${season}:${subject}-${crn}`,
        },
      ],
      ucsd_calendar: {
        term_date_range: {
          start: '2026-09-24',
          end: '2026-12-12',
        },
        section_id: `${season}:${subject}-${crn}`,
        section_code: section,
        meeting_type: meetingType,
        meetings: sourceMeetings,
        source_note: 'UCSD Schedule of Classes',
      },
    },
  } as unknown as CatalogListing;
}

function worksheetCourse(listing: CatalogListing): WorksheetCourse {
  return {
    crn: listing.crn,
    color: '#123456',
    listing,
    hidden: false,
  };
}

describe('calendar export', () => {
  it('exports timed ICS events across the configured Term Date Range', () => {
    const listing = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      meetings: [
        {
          days_of_week: dayMask(1, 3),
          start_time: '09:00',
          end_time: '09:50',
          location: {
            room: '101',
            building: {
              code: 'CENTR',
            },
          },
          raw_location: 'CENTR 101',
        },
      ],
    });

    const exportResult = getCalendarExport(
      'ics',
      [worksheetCourse(listing)],
      'FA26' as Season,
    );

    expect(exportResult.skippedMeetings).toEqual([]);
    expect(exportResult.events).toHaveLength(1);
    expect(exportResult.events[0]).toContain('SUMMARY:CSE 3 A00 Lecture');
    expect(exportResult.events[0]).toContain('COLOR:#123456');
    expect(exportResult.events[0]).toContain(
      'DTSTART;TZID=America/New_York:20260928T090000',
    );
    expect(exportResult.events[0]).toContain(
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261212T235900Z',
    );
    expect(exportResult.events[0]).toContain('LOCATION:CENTR 101');
    expect(exportResult.events[0]).toContain('Course: CSE 3');
    expect(exportResult.events[0]).toContain('Section: A00');
    expect(exportResult.events[0]).toContain('Meeting type: Lecture');
    expect(exportResult.events[0]).toContain('Title: CSE 3 title');
    expect(exportResult.events[0]).toContain('Instructor: Ada Lovelace');
    expect(exportResult.events[0]).toContain(
      'Source: UCSD Schedule of Classes',
    );
  });

  it('skips TBA and arranged Meetings with a visible summary', () => {
    const listing = makeListing({
      courseCode: 'MATH 2',
      crn: 202,
      meetings: [],
      sourceMeetings: [
        {
          days: [],
          start_time: null,
          end_time: null,
          building: null,
          room: null,
          is_tba: true,
          raw_days: 'ARRANGED',
          raw_time: 'ARRANGED',
          raw_location: 'ARRANGED',
        },
      ],
    });

    const exportResult = getCalendarExport(
      'ics',
      [worksheetCourse(listing)],
      'FA26' as Season,
    );

    expect(exportResult.events).toEqual([]);
    expect(exportResult.skippedMeetings).toEqual([
      {
        courseCode: 'MATH 2',
        section: 'A00',
        meetingType: 'Lecture',
        rawDays: 'ARRANGED',
        rawTime: 'ARRANGED',
        rawLocation: 'ARRANGED',
        reason: 'TBA or arranged Meeting',
      },
    ]);
    expect(formatSkippedMeetingsSummary(exportResult.skippedMeetings)).toBe(
      'Skipped 1 TBA or arranged Meeting: MATH 2 A00 Lecture (ARRANGED).',
    );
  });

  it('exports timed Meetings even when selected Sections conflict', () => {
    const first = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      section: 'A00',
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '09:00',
          end_time: '09:50',
        },
      ],
    });
    const second = makeListing({
      courseCode: 'MATH 20A',
      crn: 202,
      section: 'B00',
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '09:30',
          end_time: '10:20',
        },
      ],
    });

    const exportResult = getCalendarExport(
      'ics',
      [worksheetCourse(first), worksheetCourse(second)],
      'FA26' as Season,
    );

    expect(exportResult.events).toHaveLength(2);
    expect(exportResult.events.join('\n')).toContain('SUMMARY:CSE 3 A00');
    expect(exportResult.events.join('\n')).toContain('SUMMARY:MATH 20A B00');
  });

  it('exports dated final exams as one-time ICS events', () => {
    const listing = makeListing({
      courseCode: 'ECON 120A',
      crn: 303,
      section: 'A01',
      meetings: [
        {
          date: '2026-08-01',
          days_of_week: dayMask(6),
          start_time: '08:00',
          end_time: '10:59',
          meeting_type: 'Final',
          location: {
            room: '130',
            building: {
              code: 'COA',
            },
          },
        },
      ],
    });

    const exportResult = getCalendarExport(
      'ics',
      [worksheetCourse(listing)],
      'S126' as Season,
    );

    expect(exportResult.skippedMeetings).toEqual([]);
    expect(exportResult.events).toHaveLength(1);
    expect(exportResult.events[0]).toContain('SUMMARY:ECON 120A A01 Final');
    expect(exportResult.events[0]).toContain(
      'DTSTART;TZID=America/New_York:20260801T080000',
    );
    expect(exportResult.events[0]).toContain(
      'DTEND;TZID=America/New_York:20260801T105900',
    );
    expect(exportResult.events[0]).toContain('Meeting type: Final');
    expect(exportResult.events[0]).toContain('LOCATION:COA 130');
    expect(exportResult.events[0]).not.toContain('RRULE:');
  });
});
