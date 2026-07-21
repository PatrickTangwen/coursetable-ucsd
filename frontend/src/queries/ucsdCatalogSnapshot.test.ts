import { describe, expect, it } from 'vitest';
import {
  catalogResponseToCourseMap,
  getUcsdArchiveDetails,
  type UcsdCalendarDetails,
} from './ucsdCatalogSnapshot';

function getCalendarDetails(course: unknown) {
  return (course as { ucsd_calendar: UcsdCalendarDetails }).ucsd_calendar;
}

describe('UCSD Catalog Snapshot frontend adapter', () => {
  it('converts a Published Snapshot fixture into the existing catalog map shape', () => {
    const catalog = catalogResponseToCourseMap({
      run_id: 'run-frontend-fixture',
      generated_at: '2026-06-19T12:00:00.000Z',
      active_planning_term: 'FA26',
      term_label: 'Fall 2026',
      term_date_range: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      configured_subjects: ['CSE'],
      source_timestamps: {
        schedule_of_classes: '2026-07-20T00:00:00-07:00',
        general_catalog: null,
        instructor_grade_archive: null,
      },
      courses: [
        {
          course_id: 'CSE:1',
          subject: 'CSE',
          course_number: '1',
          title: 'Tracer Course',
          units: '4',
          description: 'A Course Snapshot fixture.',
          prerequisites_text: 'None',
          restrictions_text: 'Restricted to configured fixture students.',
          catalog_url: 'https://catalog.ucsd.edu/courses/CSE.html#cse1',
          archive_avg_gpa: 3.42,
          archive_record_count: 1,
          grade_archive_records: [
            {
              subject: 'CSE',
              course: '1',
              year: '2025',
              quarter: 'FA',
              title: 'Tracer Course',
              instructor: 'Ada Lovelace',
              gpa: 3.42,
              a: 48.1,
              b: 32.2,
              c: 12.3,
              d: 2.4,
              f: 1,
              w: 3,
              p: 0.8,
              np: 0.2,
              raw: {
                Subject: 'CSE',
                Course: '1',
                Year: '2025',
                Quarter: 'FA',
                Title: 'Tracer Course',
                Instructor: 'Ada Lovelace',
                GPA: '3.42',
                A: '48.1',
                B: '32.2',
                C: '12.3',
                D: '2.4',
                F: '1.0',
                W: '3.0',
                P: '0.8',
                NP: '0.2',
              },
            },
          ],
          ge_matches: [],
          sections: [
            {
              section_id: 'FA26:CSE-TRACER-001',
              course_id: 'CSE:1',
              section_code: 'A00',
              meeting_type: 'Lecture',
              instructors: ['Ada Lovelace'],
              meetings: [
                {
                  days: ['Monday', 'Wednesday'],
                  start_time: '09:00',
                  end_time: '09:50',
                  building: 'CENTR',
                  room: '101',
                  is_tba: false,
                  meeting_type: 'Lecture',
                  raw_days: 'MW',
                  raw_time: '9:00-9:50',
                  raw_location: 'CENTR 101',
                },
              ],
              enrolled: 80,
              capacity: 100,
              waitlist_count: 0,
              raw: {
                source: 'fixture',
              },
            },
          ],
        },
      ],
    });

    const [course] = [...catalog.values()];
    const [listing] = course!.listings;

    expect(course).toMatchObject({
      season_code: 'FA26',
      title: 'Tracer Course',
      credits: 4,
      section: 'A00',
      requirements: 'None\nRestricted to configured fixture students.',
      course_professors: [
        {
          professor: {
            name: 'Ada Lovelace',
          },
        },
      ],
      course_meetings: [
        {
          days_of_week: 10,
          start_time: '09:00',
          end_time: '09:50',
          meeting_type: 'Lecture',
          raw_location: 'CENTR 101',
          location: {
            room: '101',
            building: {
              code: 'CENTR',
            },
          },
        },
      ],
    });
    expect(listing).toMatchObject({
      course_code: 'CSE 1',
      number: '1',
      school: 'UCSD',
      subject: 'CSE',
      section_id: 'FA26:CSE-TRACER-001',
    });
    expect(course!.course_meetings[0]).toHaveProperty('date', null);
    expect(getCalendarDetails(course)).toMatchObject({
      term_date_range: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      section_id: 'FA26:CSE-TRACER-001',
      section_code: 'A00',
      meeting_type: 'Lecture',
      enrolled: 80,
      capacity: 100,
      waitlist_count: 0,
      meetings: [
        {
          days: ['Monday', 'Wednesday'],
          start_time: '09:00',
          end_time: '09:50',
          building: 'CENTR',
          room: '101',
          is_tba: false,
          meeting_type: 'Lecture',
          raw_days: 'MW',
          raw_time: '9:00-9:50',
          raw_location: 'CENTR 101',
        },
      ],
      source_note: 'fixture',
    });
    expect(typeof listing!.crn).toBe('number');

    expect(getUcsdArchiveDetails(course)).toEqual({
      archive_record_count: 1,
      source_timestamp: null,
      catalog_source_timestamp: null,
      catalog_url: 'https://catalog.ucsd.edu/courses/CSE.html#cse1',
      units: '4',
      prerequisites_text: 'None',
      restrictions_text: 'Restricted to configured fixture students.',
      grade_archive_records: [
        {
          subject: 'CSE',
          course: '1',
          year: '2025',
          quarter: 'FA',
          title: 'Tracer Course',
          instructor: 'Ada Lovelace',
          gpa: 3.42,
          a: 48.1,
          b: 32.2,
          c: 12.3,
          d: 2.4,
          f: 1,
          w: 3,
          p: 0.8,
          np: 0.2,
          raw: {
            Subject: 'CSE',
            Course: '1',
            Year: '2025',
            Quarter: 'FA',
            Title: 'Tracer Course',
            Instructor: 'Ada Lovelace',
            GPA: '3.42',
            A: '48.1',
            B: '32.2',
            C: '12.3',
            D: '2.4',
            F: '1.0',
            W: '3.0',
            P: '0.8',
            NP: '0.2',
          },
        },
      ],
    });
    expect(getUcsdArchiveDetails(course)).not.toHaveProperty('archive_avg_gpa');
  });

  it('preserves TBA and arranged Meeting metadata for skipped calendar summaries', () => {
    const catalog = catalogResponseToCourseMap({
      run_id: 'run-tba-fixture',
      generated_at: '2026-06-19T12:00:00.000Z',
      active_planning_term: 'FA26',
      term_label: 'Fall 2026',
      term_date_range: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      configured_subjects: ['MATH'],
      source_timestamps: {
        schedule_of_classes: null,
        general_catalog: null,
        instructor_grade_archive: null,
      },
      courses: [
        {
          course_id: 'MATH:2',
          subject: 'MATH',
          course_number: '2',
          title: 'Introduction to College Mathematics',
          units: '4',
          description: null,
          prerequisites_text: null,
          restrictions_text: null,
          catalog_url: null,
          archive_avg_gpa: null,
          archive_record_count: 0,
          grade_archive_records: [],
          ge_matches: [],
          sections: [
            {
              section_id: 'FA26:MATH-TBA-001',
              course_id: 'MATH:2',
              section_code: 'A01',
              meeting_type: 'Discussion',
              instructors: ['Noether, Emmy'],
              meetings: [
                {
                  days: [],
                  start_time: null,
                  end_time: null,
                  building: null,
                  room: null,
                  is_tba: true,
                  meeting_type: 'Discussion',
                  raw_days: 'ARRANGED',
                  raw_time: 'ARRANGED',
                  raw_location: 'ARRANGED',
                },
              ],
              enrolled: null,
              capacity: null,
              waitlist_count: 0,
              raw: {
                source: 'ucsd_schedule_of_classes',
              },
            },
          ],
        },
      ],
    });

    const [course] = [...catalog.values()];

    expect(course!.course_meetings).toEqual([]);
    expect(getCalendarDetails(course)).toMatchObject({
      section_code: 'A01',
      meeting_type: 'Discussion',
      source_note: 'UCSD Schedule of Classes',
      meetings: [
        {
          is_tba: true,
          meeting_type: 'Discussion',
          raw_days: 'ARRANGED',
          raw_time: 'ARRANGED',
          raw_location: 'ARRANGED',
        },
      ],
    });
  });

  it('dedupes repeated snapshot meetings before exposing them to frontend UI', () => {
    const catalog = catalogResponseToCourseMap({
      run_id: 'run-dedupe-fixture',
      generated_at: '2026-06-30T12:00:00.000Z',
      active_planning_term: 'FA24',
      term_label: 'Fall 2024',
      term_date_range: {
        start: '2024-09-23',
        end: '2024-12-14',
      },
      configured_subjects: ['MATH'],
      source_timestamps: {
        schedule_of_classes: null,
        general_catalog: null,
        instructor_grade_archive: null,
      },
      courses: [
        {
          course_id: 'MATH:3B',
          subject: 'MATH',
          course_number: '3B',
          title: 'Foundations of Precalculus',
          units: '4',
          description: null,
          prerequisites_text: null,
          restrictions_text: null,
          catalog_url: null,
          archive_avg_gpa: null,
          archive_record_count: 0,
          grade_archive_records: [],
          ge_matches: [],
          sections: [
            {
              section_id: 'FA24:560201',
              course_id: 'MATH:3B',
              section_code: 'A01',
              meeting_type: 'Discussion',
              instructors: ['Hammock, Frances H'],
              meetings: [
                {
                  days: ['Monday', 'Wednesday', 'Friday'],
                  date: null,
                  start_time: '09:00',
                  end_time: '09:50',
                  building: 'CENTR',
                  room: '216',
                  is_tba: false,
                  meeting_type: 'Lecture',
                  raw_days: 'MWF',
                  raw_time: '9:00a-9:50a',
                  raw_location: 'CENTR 216',
                },
                {
                  days: ['Monday', 'Wednesday', 'Friday'],
                  date: null,
                  start_time: '09:00',
                  end_time: '09:50',
                  building: 'CENTR',
                  room: '216',
                  is_tba: false,
                  meeting_type: 'Lecture',
                  raw_days: 'MWF',
                  raw_time: '9:00a-9:50a',
                  raw_location: 'CENTR 216',
                },
                {
                  days: ['Tuesday'],
                  date: null,
                  start_time: '08:00',
                  end_time: '08:50',
                  building: 'HSS',
                  room: '4025',
                  is_tba: false,
                  meeting_type: 'Discussion',
                  raw_days: 'Tu',
                  raw_time: '8:00a-8:50a',
                  raw_location: 'HSS 4025',
                },
                {
                  days: ['Tuesday'],
                  date: null,
                  start_time: '08:00',
                  end_time: '08:50',
                  building: 'HSS',
                  room: '4025',
                  is_tba: false,
                  meeting_type: 'Discussion',
                  raw_days: 'Tu',
                  raw_time: '8:00a-8:50a',
                  raw_location: 'HSS 4025',
                },
                {
                  days: ['Saturday'],
                  date: '2024-12-07',
                  start_time: '08:00',
                  end_time: '10:59',
                  building: 'CENTR',
                  room: '216',
                  is_tba: false,
                  meeting_type: 'Final',
                  raw_days: 'S',
                  raw_time: '8:00a-10:59a',
                  raw_location: 'CENTR 216',
                },
                {
                  days: ['Saturday'],
                  date: '2024-12-07',
                  start_time: '08:00',
                  end_time: '10:59',
                  building: 'CENTR',
                  room: '216',
                  is_tba: false,
                  meeting_type: 'Final',
                  raw_days: 'S',
                  raw_time: '8:00a-10:59a',
                  raw_location: 'CENTR 216',
                },
              ],
              enrolled: 36,
              capacity: 36,
              waitlist_count: 0,
              raw: {
                source: 'ucsd_schedule_of_classes',
              },
            },
          ],
        },
      ],
    });

    const [course] = [...catalog.values()];

    expect(course!.course_meetings).toMatchObject([
      {
        meeting_type: 'Lecture',
        raw_location: 'CENTR 216',
      },
      {
        meeting_type: 'Discussion',
        raw_location: 'HSS 4025',
      },
      {
        meeting_type: 'Final',
        raw_location: 'CENTR 216',
        date: '2024-12-07',
      },
    ]);
    expect(course!.course_meetings).toHaveLength(3);
    expect(getCalendarDetails(course).meetings).toHaveLength(3);
  });

  it('normalizes missing seat fields from tracer sections as unknown availability', () => {
    const catalog = catalogResponseToCourseMap({
      run_id: 'run-tracer-fixture',
      generated_at: '2026-06-19T12:00:00.000Z',
      active_planning_term: 'FA26',
      term_label: 'Fall 2026',
      term_date_range: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      configured_subjects: ['CSE'],
      source_timestamps: {
        schedule_of_classes: null,
        general_catalog: null,
        instructor_grade_archive: null,
      },
      courses: [
        {
          course_id: 'CSE:3',
          subject: 'CSE',
          course_number: '3',
          title: 'Tracer Course',
          units: '4',
          description: null,
          prerequisites_text: null,
          restrictions_text: null,
          catalog_url: null,
          archive_avg_gpa: null,
          archive_record_count: 0,
          grade_archive_records: [],
          ge_matches: [],
          sections: [
            {
              section_id: 'FA26:CSE-TRACER-3',
              course_id: 'CSE:3',
              section_code: 'A00',
              meeting_type: 'Lecture',
              instructors: [],
              meetings: [
                {
                  days: [],
                  start_time: null,
                  end_time: null,
                  building: null,
                  room: null,
                  is_tba: true,
                  raw_days: null,
                  raw_time: 'TBA',
                  raw_location: null,
                },
              ],
              raw: {
                source: 'tracer',
              },
            },
          ],
        },
      ],
    });

    const [course] = [...catalog.values()];

    expect(getCalendarDetails(course)).toMatchObject({
      enrolled: null,
      capacity: null,
      waitlist_count: null,
    });
  });
});
