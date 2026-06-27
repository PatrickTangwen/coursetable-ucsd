/* eslint-disable camelcase */
import { describe, expect, it } from 'vitest';

import {
  buildUcsdSnapshotModalCourse,
  formatSnapshotUpdatedLabel,
  formatUcsdAvailability,
  getSectionVaryingMeetings,
  type UcsdModalListing,
} from './ucsdSnapshotModalData';

type MeetingFixture = {
  days: string[];
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  is_tba: boolean;
  meeting_type: string | null;
  raw_days: string | null;
  raw_time: string | null;
  raw_location: string | null;
};

function meeting(
  meeting_type: string,
  raw_days: string,
  start_time: string,
  end_time: string,
  building = 'CENTR',
  room = '115',
): MeetingFixture {
  return {
    days: raw_days === 'TuTh' ? ['Tuesday', 'Thursday'] : [raw_days],
    start_time,
    end_time,
    building,
    room,
    is_tba: false,
    meeting_type,
    raw_days,
    raw_time: `${start_time}-${end_time}`,
    raw_location: `${building} ${room}`,
  };
}

function listing({
  crn,
  sectionCode,
  meetings,
  enrolled,
  capacity,
  waitlist = 0,
}: {
  crn: number;
  sectionCode: string;
  meetings: MeetingFixture[];
  enrolled: number;
  capacity: number;
  waitlist?: number;
}): UcsdModalListing {
  return {
    crn,
    course_code: 'CSE 8A',
    number: '8A',
    school: 'UCSD',
    section_id: `SP26:CSE-8A-${sectionCode}`,
    subject: 'CSE',
    course: {
      course_id: crn,
      same_course_id: 8001,
      season_code: 'SP26',
      section: sectionCode,
      title: 'Introduction to Programming',
      description: 'Course description',
      credits: 4,
      time_added: '2026-06-20T00:00:00.000Z',
      last_updated: '2026-06-20T00:00:00.000Z',
      listings: [
        {
          crn,
          course_code: 'CSE 8A',
          section_id: `SP26:CSE-8A-${sectionCode}`,
        },
      ],
      course_professors: [
        {
          professor: {
            professor_id: 1,
            name: 'Ada Lovelace',
          },
        },
      ],
      course_meetings: [],
      ucsd_calendar: {
        term_date_range: {
          start: '2026-03-30',
          end: '2026-06-12',
        },
        section_id: `SP26:CSE-8A-${sectionCode}`,
        section_code: sectionCode,
        meeting_type: 'Laboratory',
        meetings,
        enrolled,
        capacity,
        waitlist_count: waitlist,
        source_note: 'fixture',
      },
      ucsd_archive: {
        archive_avg_gpa: null,
        archive_record_count: 0,
        source_timestamp: null,
        catalog_source_timestamp: null,
        catalog_url: null,
        units: '4',
        prerequisites_text: null,
        restrictions_text: null,
        grade_archive_records: [],
      },
    },
  } as unknown as UcsdModalListing;
}

describe('UCSD snapshot modal data', () => {
  it('groups same-course listings into offering families with shared anchors', () => {
    const lecture = meeting('Lecture', 'TuTh', '09:30', '10:50');
    const discussion = meeting('Discussion', 'W', '15:00', '15:50');
    const a50 = listing({
      crn: 100,
      sectionCode: 'A50',
      meetings: [
        lecture,
        discussion,
        meeting('Laboratory', 'W', '10:00', '10:50', 'EBU3B', 'B250'),
      ],
      enrolled: 37,
      capacity: 49,
    });
    const a51 = listing({
      crn: 101,
      sectionCode: 'A51',
      meetings: [
        lecture,
        discussion,
        meeting('Laboratory', 'W', '11:00', '11:50', 'EBU3B', 'B250'),
      ],
      enrolled: 25,
      capacity: 49,
    });
    const b50 = listing({
      crn: 200,
      sectionCode: 'B50',
      meetings: [
        meeting('Lecture', 'TuTh', '12:30', '13:50', 'CSB', '002'),
        meeting('Discussion', 'M', '16:00', '16:50'),
        meeting('Laboratory', 'F', '10:00', '11:50', 'EBU3B', 'B240'),
      ],
      enrolled: 38,
      capacity: 40,
    });

    const modalCourse = buildUcsdSnapshotModalCourse(b50, [a50, a51, b50]);

    expect(modalCourse.activeFamily).toBe('B');
    expect(modalCourse.groups.map((group) => group.familyPrefix)).toEqual([
      'A',
      'B',
    ]);

    const [groupA] = modalCourse.groups;
    expect(groupA!.sharedMeetings.map((m) => m.meeting_type)).toEqual([
      'Lecture',
      'Discussion',
    ]);
    expect(
      getSectionVaryingMeetings(groupA!.sections[0]!, groupA!).map(
        (m) => m.meeting_type,
      ),
    ).toEqual(['Laboratory']);
  });

  it('formats availability and snapshot age labels for modal rows', () => {
    expect(formatUcsdAvailability(48, 48, 2)).toMatchObject({
      main: 'FULL · WL(2)',
      status: 'full',
    });
    expect(formatUcsdAvailability(37, 49, 0)).toMatchObject({
      main: '12 seats left',
      detail: '',
      status: 'critical',
    });
    expect(
      formatSnapshotUpdatedLabel(
        '2026-06-20T00:00:00.000Z',
        new Date('2026-06-26T00:00:00.000Z'),
      ),
    ).toBe('Updated 6 days ago');
  });
});
