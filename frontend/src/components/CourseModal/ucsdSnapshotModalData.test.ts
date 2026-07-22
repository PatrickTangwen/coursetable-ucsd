/* eslint-disable camelcase */
import { describe, expect, it } from 'vitest';

import {
  buildUcsdSnapshotModalCourse,
  formatSnapshotStalenessLabel,
  formatSnapshotUpdatedLabel,
  formatUcsdAvailability,
  getSectionVaryingMeetings,
  shouldShowUcsdSectionSelector,
  tssCourseDetailGroups,
  type UcsdModalListing,
} from './ucsdSnapshotModalData';
import type { CoursePlanningListing } from '../../queries/coursePlanningViewModels';

type MeetingFixture = {
  days: string[];
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  building: string | null;
  room: string | null;
  isTba: boolean;
  meetingType: string | null;
  rawDays: string | null;
  rawTime: string | null;
  rawLocation: string | null;
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
    date: null,
    startTime: start_time,
    endTime: end_time,
    building,
    room,
    isTba: false,
    meetingType: meeting_type,
    rawDays: raw_days,
    rawTime: `${start_time}-${end_time}`,
    rawLocation: `${building} ${room}`,
  };
}

function tbaMeeting(meeting_type: string): MeetingFixture {
  return {
    days: [],
    date: null,
    startTime: null,
    endTime: null,
    building: null,
    room: null,
    isTba: true,
    meetingType: meeting_type,
    rawDays: 'TBA',
    rawTime: 'TBA',
    rawLocation: 'TBA',
  };
}

function listing({
  sectionCode,
  meetings,
  enrolled,
  capacity,
  waitlist = 0,
  supportedTerm = 'SP26',
}: {
  crn: number;
  sectionCode: string;
  meetings: MeetingFixture[];
  enrolled: number;
  capacity: number;
  waitlist?: number;
  supportedTerm?: string;
}): UcsdModalListing {
  return {
    course: {
      courseId: 'CSE:8A',
      subject: 'CSE',
      courseNumber: '8A',
      courseCode: 'CSE 8A',
      title: 'Introduction to Programming',
      description: 'Course description',
      units: '4',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
    section: {
      sectionId: `${supportedTerm}:CSE-8A-${sectionCode}`,
      courseId: 'CSE:8A',
      supportedTerm,
      sectionCode,
      meetingType: 'Laboratory',
      instructors: [{ name: 'Ada Lovelace' }],
      meetings,
      availability: {
        enrolled,
        capacity,
        availableSeats: capacity - enrolled,
        capacityKind: 'bounded',
        waitlistCount: waitlist,
        snapshotTimestamp: '2026-06-20T00:00:00.000Z',
      },
      sourceNote: 'fixture',
    },
    generatedAt: '2026-06-20T00:00:00.000Z',
    catalogCoverage: { complete: true, continuationNeeded: false },
    evaluation: {
      overallRating: null,
      workload: null,
      professorRating: null,
      gutRating: null,
      enrollment: null,
    },
  } satisfies CoursePlanningListing;
}

describe('UCSD snapshot modal data', () => {
  it('keeps TSS notes and enrollment requirement hierarchy visible', () => {
    const { course } = listing({
      crn: 101,
      sectionCode: '001-000',
      meetings: [meeting('Lecture', 'M', '10:00', '10:50')],
      enrolled: 20,
      capacity: 30,
      supportedTerm: 'FA26',
    });
    course.deliveryMode = 'In Person';
    course.departmentNotes = ['Department note.'];
    course.courseNotes = ['Course note.'];
    course.enrollmentRequirements = [
      { id: 'root', parentId: null, text: 'Allowed classifications' },
      { id: 'freshman', parentId: 'root', text: 'Freshman' },
    ];

    expect(tssCourseDetailGroups(course)).toEqual([
      { title: 'Delivery Mode', items: [{ text: 'In Person', depth: 0 }] },
      {
        title: 'Department Notes',
        items: [{ text: 'Department note.', depth: 0 }],
      },
      {
        title: 'Course Notes',
        items: [{ text: 'Course note.', depth: 0 }],
      },
      {
        title: 'Enrollment Requirements',
        items: [
          { text: 'Allowed classifications', depth: 0 },
          { text: 'Freshman', depth: 1 },
        ],
      },
    ]);
  });

  it('shows the section selector only when there are multiple offering groups', () => {
    const section = listing({
      crn: 101,
      sectionCode: 'A00',
      meetings: [meeting('Lecture', 'M', '10:00', '10:50')],
      enrolled: 20,
      capacity: 30,
    });
    const secondGroup = listing({
      crn: 102,
      sectionCode: 'B00',
      meetings: [meeting('Lecture', 'W', '10:00', '10:50')],
      enrolled: 20,
      capacity: 30,
    });

    const singleGroup = buildUcsdSnapshotModalCourse(section, [section]);
    const multipleGroups = buildUcsdSnapshotModalCourse(section, [
      section,
      secondGroup,
    ]);

    expect(shouldShowUcsdSectionSelector(singleGroup.groups)).toBe(false);
    expect(shouldShowUcsdSectionSelector(multipleGroups.groups)).toBe(true);
  });

  it('builds the shared friendly section mapping for Fall 2026', () => {
    const a01 = listing({
      crn: 101,
      sectionCode: '001-000-LE + 001-001-DI',
      meetings: [meeting('Lecture', 'M', '10:00', '10:50')],
      enrolled: 20,
      capacity: 30,
      supportedTerm: 'FA26',
    });
    const a02 = listing({
      crn: 102,
      sectionCode: '001-000-LE + 001-002-DI',
      meetings: [meeting('Lecture', 'W', '10:00', '10:50')],
      enrolled: 21,
      capacity: 30,
      supportedTerm: 'FA26',
    });

    const modalCourse = buildUcsdSnapshotModalCourse(a01, [a02]);

    expect(
      modalCourse.sectionMapping.entries.map((entry) => entry.displayName),
    ).toEqual(['Section A · A01', 'Section A · A02']);
  });

  it('keeps duplicate Fall 2026 combinations separate by package id', () => {
    const first = listing({
      crn: 101,
      sectionCode: '001-000-LE + 001-001-DI',
      meetings: [meeting('Lecture', 'M', '10:00', '10:50')],
      enrolled: 20,
      capacity: 30,
      supportedTerm: 'FA26',
    });
    const second = listing({
      crn: 102,
      sectionCode: '001-000-LE + 001-001-DI',
      meetings: [meeting('Lecture', 'W', '10:00', '10:50')],
      enrolled: 21,
      capacity: 30,
      supportedTerm: 'FA26',
    });
    second.section.sectionId = 'FA26:CSE-8A-duplicate-package';

    const modalCourse = buildUcsdSnapshotModalCourse(first, [second]);

    expect(modalCourse.groups).toHaveLength(2);
    expect(modalCourse.groups.map((group) => group.familyPrefix)).toEqual([
      first.section.sectionId,
      second.section.sectionId,
    ]);
    expect(modalCourse.groups.map((group) => group.sections.length)).toEqual([
      1, 1,
    ]);
    expect(modalCourse.activeFamily).toBe(first.section.sectionId);
  });

  it('formats source-reported and effectively unbounded availability', () => {
    expect(formatUcsdAvailability(20, 100, null, 90)).toMatchObject({
      main: '90 seats left',
    });
    expect(
      formatUcsdAvailability(null, null, null, null, 'effectively_unbounded'),
    ).toEqual({
      main: 'Open · no fixed cap',
      detail: '',
      status: 'available',
    });
  });

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
    expect(groupA!.sharedMeetings.map((m) => m.meetingType)).toEqual([
      'Lecture',
      'Discussion',
    ]);
    expect(
      getSectionVaryingMeetings(groupA!.sections[0]!, groupA!).map(
        (m) => m.meetingType,
      ),
    ).toEqual(['Laboratory']);
  });

  it('does not collapse same-time labs in different locations into shared meetings', () => {
    const lecture = meeting(
      'Lecture',
      'TuTh',
      '11:00',
      '12:20',
      'RWAC',
      '0103',
    );
    const a01 = listing({
      crn: 101,
      sectionCode: 'A01',
      meetings: [
        lecture,
        meeting('Laboratory', 'TuTh', '13:00', '15:50', 'TATA', '2301'),
      ],
      enrolled: 23,
      capacity: 24,
    });
    const a02 = listing({
      crn: 102,
      sectionCode: 'A02',
      meetings: [
        lecture,
        meeting('Laboratory', 'TuTh', '13:00', '15:50', 'TATA', '2302'),
      ],
      enrolled: 22,
      capacity: 24,
    });

    const modalCourse = buildUcsdSnapshotModalCourse(a01, [a01, a02]);

    const [groupA] = modalCourse.groups;
    expect(groupA!.sharedMeetings.map((m) => m.meetingType)).toEqual([
      'Lecture',
    ]);
    expect(
      getSectionVaryingMeetings(groupA!.sections[0]!, groupA!).map(
        (m) => m.meetingType,
      ),
    ).toEqual(['Laboratory']);
    expect(
      getSectionVaryingMeetings(groupA!.sections[1]!, groupA!).map(
        (m) => m.room,
      ),
    ).toEqual(['2302']);
  });

  it('treats a repeated TBA lecture as a shared anchor for discussion sections', () => {
    const lecture = tbaMeeting('Lecture');
    const a01 = listing({
      crn: 101,
      sectionCode: 'A01',
      meetings: [
        lecture,
        meeting('Discussion', 'F', '09:00', '10:50', 'RCLAS', 'R25'),
      ],
      enrolled: 46,
      capacity: 46,
    });
    const a02 = listing({
      crn: 102,
      sectionCode: 'A02',
      meetings: [
        lecture,
        meeting('Discussion', 'F', '11:00', '12:50', 'RCLAS', 'R33'),
      ],
      enrolled: 46,
      capacity: 46,
      waitlist: 1,
    });

    const modalCourse = buildUcsdSnapshotModalCourse(a01, [a01, a02]);

    const [groupA] = modalCourse.groups;
    expect(groupA!.sharedMeetings.map((m) => m.meetingType)).toEqual([
      'Lecture',
    ]);
    expect(
      getSectionVaryingMeetings(groupA!.sections[0]!, groupA!).map(
        (m) => m.meetingType,
      ),
    ).toEqual(['Discussion']);
    expect(
      getSectionVaryingMeetings(groupA!.sections[1]!, groupA!).map(
        (m) => m.rawTime,
      ),
    ).toEqual(['11:00-12:50']);
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

  it('formats availability staleness by Supported Term state', () => {
    const now = new Date('2026-06-27T12:00:00.000Z');

    expect(
      formatSnapshotStalenessLabel(
        {
          term: 'FA26',
          label: 'Fall 2026',
          date_range: { start: '2026-09-24', end: '2026-12-12' },
          frozen: false,
          generated_at: '2026-06-26T12:00:00.000Z',
          snapshot_path: 'catalogs/public/FA26.json',
          manifest_path: 'catalogs/import-manifests/FA26.json',
        },
        '2026-06-20T12:00:00.000Z',
        now,
      ),
    ).toBe('Updated 1 day ago');

    expect(
      formatSnapshotStalenessLabel(
        {
          term: 'SP26',
          label: 'Spring 2026',
          date_range: { start: '2026-03-30', end: '2026-06-12' },
          frozen: false,
          generated_at: '2026-06-20T12:00:00.000Z',
          snapshot_path: 'catalogs/public/SP26.json',
          manifest_path: 'catalogs/import-manifests/SP26.json',
        },
        '2026-06-20T12:00:00.000Z',
        now,
      ),
    ).toBe('As of Jun 12, 2026 · historical snapshot, not live');

    expect(
      formatSnapshotStalenessLabel(
        {
          term: 'FA25',
          label: 'Fall 2025',
          date_range: { start: '2025-09-25', end: '2025-12-13' },
          frozen: true,
          generated_at: '2025-12-14T12:00:00.000Z',
          snapshot_path: 'catalogs/public/FA25.json',
          manifest_path: 'catalogs/import-manifests/FA25.json',
        },
        '2025-12-14T12:00:00.000Z',
        now,
      ),
    ).toBe('As of Dec 13, 2025 · historical snapshot, not live');
  });
});
