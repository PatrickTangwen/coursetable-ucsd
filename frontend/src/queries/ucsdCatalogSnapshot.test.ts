import { describe, expect, it } from 'vitest';
import {
  catalogResponseToCourseMap,
  getUcsdArchiveDetails,
} from './ucsdCatalogSnapshot';

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
        schedule_of_classes: null,
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
          restrictions_text: null,
          catalog_url: null,
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
                  raw_days: 'MW',
                  raw_time: '9:00-9:50',
                  raw_location: 'CENTR 101',
                },
              ],
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
    expect(typeof listing!.crn).toBe('number');

    expect(getUcsdArchiveDetails(course)).toEqual({
      archive_avg_gpa: 3.42,
      archive_record_count: 1,
      source_timestamp: null,
      catalog_url: null,
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
  });
});
