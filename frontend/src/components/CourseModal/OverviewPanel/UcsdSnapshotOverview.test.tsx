import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UcsdSnapshotOverview, {
  UcsdSnapshotPastGrades,
} from './UcsdSnapshotOverview';
import type { CourseModalPrefetchListingDataFragment } from '../../../generated/graphql-types';
import type { Crn, Season } from '../../../queries/graphql-types';
import type { UcsdCourseArchive } from '../../../queries/ucsdCatalogSnapshot';

function listing() {
  return {
    crn: 1804430517 as Crn,
    course_code: 'CSE 1',
    course: {
      season_code: 'FA26' as Season,
      section: 'A00',
      title: 'Tracer Course',
      skills: [],
      areas: [],
      extra_info: 'ACTIVE',
      description: 'UCSD catalog description.',
      same_course_id: 1,
      primary_crn: 1804430517 as Crn,
      listings: [{ crn: 1804430517 as Crn, course_code: 'CSE 1' }],
      course_professors: [
        {
          professor: {
            professor_id: 1,
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
          location: {
            room: '101',
            building: {
              code: 'CENTR',
            },
          },
          raw_location: 'CENTR 101',
        },
        {
          days_of_week: 4,
          start_time: '10:00',
          end_time: '10:50',
          meeting_type: 'Discussion',
          location: {
            room: '212',
            building: {
              code: 'CENTR',
            },
          },
          raw_location: 'CENTR 212',
        },
      ],
      credits: 4,
    },
  } as unknown as CourseModalPrefetchListingDataFragment;
}

const archiveWithRecord: UcsdCourseArchive = {
  archive_avg_gpa: 3.42,
  archive_record_count: 1,
  source_timestamp: null,
  catalog_source_timestamp: null,
  catalog_url: 'https://catalog.ucsd.edu/courses/CSE.html#cse1',
  units: '4',
  prerequisites_text: 'None',
  restrictions_text: null,
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
      raw: {},
    },
  ],
};

function gradeArchiveRecord(
  year: string,
  instructor: string,
): UcsdCourseArchive['grade_archive_records'][number] {
  return {
    subject: 'CSE',
    course: '1',
    year,
    quarter: 'FA',
    title: 'Tracer Course',
    instructor,
    gpa: 3.42,
    a: 48.1,
    b: 32.2,
    c: 12.3,
    d: 2.4,
    f: 1,
    w: 3,
    p: 0.8,
    np: 0.2,
    raw: {},
  };
}

describe('UcsdSnapshotOverview', () => {
  it('shows supported snapshot metadata without the GPA summary card', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotOverview archive={archiveWithRecord} listing={listing()} />,
    );

    expect(html).not.toContain('Average GPA');
    expect(html).not.toContain('Record Count');
    expect(html).not.toContain('Grade Archive Records');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Location');
    expect(html).toContain('LE: MW 9:00am-9:50am');
    expect(html).toContain('DI: T 10:00am-10:50am');
    expect(html).toContain('LE: CENTR 101');
    expect(html).toContain('DI: CENTR 212');
    expect(html.indexOf('Meetings')).toBeLessThan(html.indexOf('Location'));
    expect(html.indexOf('Location')).toBeLessThan(html.indexOf('Section'));
  });

  it('shows a compact UCSD-specific missing archive state', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotOverview archive={null} listing={listing()} />,
    );

    expect(html).not.toContain('Average GPA');
    expect(html).not.toContain('Record Count');
    expect(html).not.toContain('Grade Archive Records');
    expect(html.toLowerCase()).not.toMatch(
      /\b(?:rating|workload|evaluations?|friends|oce|cape)\b/u,
    );
  });
});

describe('UcsdSnapshotPastGrades', () => {
  it('shows UCSD archive records', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotPastGrades archive={archiveWithRecord} />,
    );

    expect(html).not.toContain('Grade Archive Records');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('3.42');
  });

  it('orders past grade records by descending term', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotPastGrades
        archive={{
          ...archiveWithRecord,
          archive_record_count: 3,
          grade_archive_records: [
            {
              ...gradeArchiveRecord('2025', 'Winter Instructor'),
              quarter: 'WI',
            },
            gradeArchiveRecord('2024', 'Earlier Instructor'),
            {
              ...gradeArchiveRecord('2025', 'Fall Instructor'),
              quarter: 'FA',
            },
          ],
        }}
      />,
    );

    expect(html.indexOf('Fall Instructor')).toBeLessThan(
      html.indexOf('Winter Instructor'),
    );
    expect(html.indexOf('Winter Instructor')).toBeLessThan(
      html.indexOf('Earlier Instructor'),
    );
  });

  it('shows a UCSD-specific missing archive state without inherited wording', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotPastGrades archive={null} />,
    );

    expect(html).not.toContain('Grade Archive Records');
    expect(html).toContain('UCSD archive metadata is unavailable');
    expect(html).toContain('Historical GPA Data');
    expect(html.toLowerCase()).not.toMatch(
      /\b(?:rating|workload|evaluations?|friends|oce|cape)\b/u,
    );
  });
});
