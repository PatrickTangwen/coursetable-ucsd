import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UcsdSnapshotOverview from './UcsdSnapshotOverview';
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
  it('shows UCSD archive records and supported snapshot metadata', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotOverview archive={archiveWithRecord} listing={listing()} />,
    );

    expect(html).toContain('Archive Avg GPA');
    expect(html).toContain('3.42');
    expect(html).toContain('Record Count');
    expect(html).toContain('Grade Archive Records');
    expect(html).toContain('Ada Lovelace');
  });

  it('orders Grade Archive Records by descending year', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotOverview
        archive={{
          ...archiveWithRecord,
          archive_record_count: 3,
          grade_archive_records: [
            gradeArchiveRecord('2024', 'Earlier Instructor'),
            gradeArchiveRecord('2026', 'Latest Instructor'),
            gradeArchiveRecord('2025', 'Middle Instructor'),
          ],
        }}
        listing={listing()}
      />,
    );

    expect(html.indexOf('Latest Instructor')).toBeLessThan(
      html.indexOf('Middle Instructor'),
    );
    expect(html.indexOf('Middle Instructor')).toBeLessThan(
      html.indexOf('Earlier Instructor'),
    );
  });

  it('shows a UCSD-specific missing archive state without inherited wording', () => {
    const html = renderToStaticMarkup(
      <UcsdSnapshotOverview archive={null} listing={listing()} />,
    );

    expect(html).toContain('Archive Avg GPA');
    expect(html).toContain('Record Count');
    expect(html).toContain('Grade Archive Records');
    expect(html).toContain('UCSD archive metadata is unavailable');
    expect(html).toContain('Historical GPA Data');
    expect(html.toLowerCase()).not.toMatch(
      /\b(rating|workload|evaluations?|friends|oce|cape)\b/u,
    );
  });
});
