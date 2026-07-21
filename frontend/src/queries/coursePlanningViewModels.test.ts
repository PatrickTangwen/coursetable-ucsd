import { describe, expect, it } from 'vitest';

import {
  coursePlanningSectionModalId,
  flattenCoursePlanningCatalog,
  normalizePublishedSnapshot,
} from './coursePlanningViewModels';
import type { Season } from './graphql-types';
import { adaptCoursePlanningCatalog } from './ucsdCatalogSnapshot';
import { coursePlanningListingToWorksheetCourse } from '../types/worksheetCourse';
import { getCalendarExport } from '../utilities/calendar';

describe('Published Snapshot Course Planning view-model seam', () => {
  it('normalizes canonical Course Planning data without inherited transport fields', () => {
    const catalog = normalizePublishedSnapshot({
      run_id: 'run-view-model-fixture',
      generated_at: '2026-07-17T12:00:00.000Z',
      active_planning_term: 'FA26',
      term_label: 'Fall 2026',
      term_date_range: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      coverage: { complete: false, continuation_needed: true },
      configured_subjects: ['CSE'],
      source_timestamps: {
        schedule_of_classes: '2026-07-17T10:00:00.000Z',
        general_catalog: '2026-07-16T10:00:00.000Z',
        instructor_grade_archive: '2026-07-15T10:00:00.000Z',
      },
      courses: [
        {
          course_id: 'CSE:1',
          subject: 'CSE',
          course_number: '1',
          display_course_code: 'CSE-001',
          title: 'Tracer Course',
          units: '4',
          description: 'A Course Planning fixture.',
          prerequisites_text: 'CSE 0',
          restrictions_text: 'Major restriction',
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
              raw: { source: 'fixture' },
            },
          ],
          ge_matches: [],
          sections: [
            {
              section_id: 'FA26:123456',
              course_id: 'CSE:1',
              section_code: 'A00',
              meeting_type: 'Lecture',
              instructors: ['Ada Lovelace'],
              meetings: [
                {
                  days: ['Monday', 'Wednesday'],
                  date: null,
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
              waitlist_count: 2,
              raw: { source: 'ucsd_tss' },
            },
          ],
        },
      ],
    });

    expect(catalog).toEqual({
      supportedTerm: 'FA26',
      termLabel: 'Fall 2026',
      generatedAt: '2026-07-17T12:00:00.000Z',
      termDateRange: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      sourceTimestamps: {
        scheduleOfClasses: '2026-07-17T10:00:00.000Z',
        generalCatalog: '2026-07-16T10:00:00.000Z',
        instructorGradeArchive: '2026-07-15T10:00:00.000Z',
      },
      coverage: { complete: false, continuationNeeded: true },
      courses: [
        {
          courseId: 'CSE:1',
          subject: 'CSE',
          courseNumber: '1',
          courseCode: 'CSE-001',
          title: 'Tracer Course',
          units: '4',
          description: 'A Course Planning fixture.',
          prerequisites: 'CSE 0',
          restrictions: 'Major restriction',
          requirements: 'CSE 0\nMajor restriction',
          catalogUrl: 'https://catalog.ucsd.edu/courses/CSE.html#cse1',
          archiveRecordCount: 1,
          pastGrades: [
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
              raw: { source: 'fixture' },
            },
          ],
          sections: [
            {
              sectionId: 'FA26:123456',
              courseId: 'CSE:1',
              supportedTerm: 'FA26',
              sectionCode: 'A00',
              meetingType: 'Lecture',
              instructors: [{ name: 'Ada Lovelace' }],
              meetings: [
                {
                  days: ['Monday', 'Wednesday'],
                  date: null,
                  startTime: '09:00',
                  endTime: '09:50',
                  building: 'CENTR',
                  room: '101',
                  isTba: false,
                  meetingType: 'Lecture',
                  rawDays: 'MW',
                  rawTime: '9:00-9:50',
                  rawLocation: 'CENTR 101',
                },
              ],
              availability: {
                enrolled: 80,
                capacity: 100,
                availableSeats: 20,
                waitlistCount: 2,
                snapshotTimestamp: '2026-07-17T10:00:00.000Z',
              },
              sourceNote:
                'TSS schedule snapshot · partial coverage; continuation needed',
            },
          ],
        },
      ],
    });

    const [listing] = flattenCoursePlanningCatalog(catalog!);
    const worksheetCourse = coursePlanningListingToWorksheetCourse(
      listing!,
      '#123456',
      false,
    );
    const calendarExport = getCalendarExport(
      'ics',
      [worksheetCourse],
      'FA26' as Season,
    );
    expect(calendarExport.events[0]).toContain(
      'partial coverage; continuation needed',
    );
  });

  it('ignores the TSS display field outside FA26', () => {
    const catalog = normalizePublishedSnapshot({
      run_id: 'run-legacy-display-fixture',
      generated_at: '2026-07-17T12:00:00.000Z',
      active_planning_term: 'SP26',
      term_label: 'Spring 2026',
      term_date_range: null,
      configured_subjects: ['CAT'],
      source_timestamps: {
        schedule_of_classes: null,
        general_catalog: null,
        instructor_grade_archive: null,
      },
      courses: [
        {
          course_id: 'CAT:1',
          subject: 'CAT',
          course_number: '1',
          display_course_code: 'CAT-001',
          title: 'Sixth College Seminar',
          units: '4',
          description: null,
          prerequisites_text: null,
          restrictions_text: null,
          catalog_url: null,
          archive_avg_gpa: null,
          archive_record_count: 0,
          grade_archive_records: [],
          ge_matches: [],
          sections: [],
        },
      ],
    });

    expect(catalog?.courses[0]).toMatchObject({
      courseId: 'CAT:1',
      courseCode: 'CAT 1',
    });
  });

  it('adapts an owned Course Planning catalog through the temporary legacy boundary', () => {
    const catalog = adaptCoursePlanningCatalog({
      supportedTerm: 'FA26',
      termLabel: 'Fall 2026',
      generatedAt: '2026-07-17T12:00:00.000Z',
      termDateRange: {
        start: '2026-09-24',
        end: '2026-12-12',
      },
      sourceTimestamps: {
        scheduleOfClasses: '2026-07-17T10:00:00.000Z',
        generalCatalog: '2026-07-16T10:00:00.000Z',
        instructorGradeArchive: '2026-07-15T10:00:00.000Z',
      },
      coverage: { complete: true, continuationNeeded: false },
      courses: [
        {
          courseId: 'CSE:1',
          subject: 'CSE',
          courseNumber: '1',
          courseCode: 'CSE 1',
          title: 'Tracer Course',
          units: '4',
          description: 'A Course Planning fixture.',
          prerequisites: 'CSE 0',
          restrictions: 'Major restriction',
          requirements: 'CSE 0\nMajor restriction',
          catalogUrl: 'https://catalog.ucsd.edu/courses/CSE.html#cse1',
          archiveRecordCount: 1,
          pastGrades: [],
          sections: [
            {
              sectionId: 'FA26:123456',
              courseId: 'CSE:1',
              supportedTerm: 'FA26',
              sectionCode: 'A00',
              meetingType: 'Lecture',
              instructors: [{ name: 'Ada Lovelace' }],
              meetings: [
                {
                  days: ['Monday', 'Wednesday'],
                  date: null,
                  startTime: '09:00',
                  endTime: '09:50',
                  building: 'CENTR',
                  room: '101',
                  isTba: false,
                  meetingType: 'Lecture',
                  rawDays: 'MW',
                  rawTime: '9:00-9:50',
                  rawLocation: 'CENTR 101',
                },
              ],
              availability: {
                enrolled: 80,
                capacity: 100,
                availableSeats: 20,
                waitlistCount: 2,
                snapshotTimestamp: '2026-07-17T10:00:00.000Z',
              },
              sourceNote: 'UCSD Schedule of Classes',
            },
          ],
        },
      ],
    });

    const [course] = [...catalog.values()];
    const [listing] = course!.listings;

    expect(coursePlanningSectionModalId('FA26:123456')).toBe(listing!.crn);

    expect(course).toMatchObject({
      title: 'Tracer Course',
      season_code: 'FA26',
      section: 'A00',
      credits: 4,
      requirements: 'CSE 0\nMajor restriction',
      course_professors: [{ professor: { name: 'Ada Lovelace' } }],
      course_meetings: [
        {
          days_of_week: 10,
          start_time: '09:00',
          end_time: '09:50',
          raw_location: 'CENTR 101',
        },
      ],
      ucsd_calendar: {
        section_id: 'FA26:123456',
        enrolled: 80,
        capacity: 100,
        waitlist_count: 2,
      },
      ucsd_archive: {
        archive_record_count: 1,
        units: '4',
        prerequisites_text: 'CSE 0',
        restrictions_text: 'Major restriction',
      },
    });
    expect(listing).toMatchObject({
      course_code: 'CSE 1',
      number: '1',
      school: 'UCSD',
      subject: 'CSE',
      section_id: 'FA26:123456',
    });
  });
});
