import { describe, expect, it } from 'vitest';

import {
  validateCatalogSnapshot,
  type CatalogSnapshotConfig,
} from './catalogSnapshot';
import { buildTssCatalogSnapshot } from './tssSchedule';

const config: CatalogSnapshotConfig = {
  active_planning_term: 'FA26',
  term_label: 'Fall 2026',
  term_date_range: null,
  configured_subjects: ['CAT'],
  paths: {
    raw_dir: 'data/raw',
    normalized_dir: 'data/normalized',
    reports_dir: 'data/reports',
    public_catalog_dir: 'api/static/catalogs/public',
    metadata_path: 'api/static/metadata.json',
  },
};

const tssResponse = {
  schema_version: 'tss-chatbot-v1',
  term: 'FA26',
  source_metadata: {
    last_refreshed_displayed: '2026-07-21T12:00:00.000Z',
  },
  coverage: { complete: true, continuation_needed: false },
  courses: [
    {
      course_code: '001',
      course_title: 'CAT 001',
      tss_course_code: 'CAT-001',
      booking_choices: [
        {
          booking_choice_ordinal: 1,
          displayed_package_section: null,
          displayed_package_id: null,
          components: [
            {
              type: 'lecture',
              section_code: '001-000-LE',
              event_id: 'E 00000665',
              requirement: 'required',
              meetings: [
                {
                  meeting_kind: 'class',
                  specific_date: null,
                  days: 'M W F',
                  start_time: '11:00am',
                  end_time: '11:50am',
                  location_displayed: 'PRICE THTRE',
                  instructor: 'Phoebe Bronstein',
                  is_tba: false,
                  is_arranged: null,
                },
              ],
              enrollment: {
                enrolled: 200,
                capacity: 256,
                seats_available: 56,
                waitlist: { state: 'not_shown', count: null },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('TSS Catalog Snapshot pipeline input', () => {
  it('publishes an FA26 display code while enriching by canonical Course ID', () => {
    const snapshot = buildTssCatalogSnapshot(config, [tssResponse], {
      runId: 'tss-fa26-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [
          {
            course_id: 'CAT:1',
            subject: 'CAT',
            course_number: '1',
            title: 'Culture, Art, and Technology 1',
            units: '4',
            description: 'General Catalog description.',
            prerequisites_text: 'Sixth College students only.',
            restrictions_text: null,
            catalog_url: 'https://catalog.ucsd.edu/courses/CAT.html#cat1',
          },
        ],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [
          {
            subject: 'CAT',
            course: '1',
            year: '25',
            quarter: 'FA',
            title: 'Culture, Art & Technology I',
            instructor: 'Ada Lovelace',
            gpa: 3.8,
            a: null,
            b: null,
            c: null,
            d: null,
            f: null,
            w: null,
            p: null,
            np: null,
            raw: {},
          },
        ],
      },
    });

    expect(snapshot.courses[0]).toMatchObject({
      course_id: 'CAT:1',
      course_number: '1',
      display_course_code: 'CAT-001',
      title: 'Culture, Art, and Technology 1',
      units: '4',
      description: 'General Catalog description.',
      catalog_url: 'https://catalog.ucsd.edu/courses/CAT.html#cat1',
      archive_record_count: 1,
      grade_archive_records: [{ gpa: 3.8 }],
      sections: [
        {
          section_id: 'FA26:CAT-001:E00000665',
          course_id: 'CAT:1',
          section_code: '001-000-LE',
          waitlist_count: null,
          availability_verified: true,
          availability_timestamp: '2026-07-21T12:00:00.000Z',
        },
      ],
    });
    expect(snapshot.coverage).toEqual({
      complete: true,
      continuation_needed: false,
    });
    expect(snapshot.source_timestamps).toEqual({
      schedule_of_classes: '2026-07-21T12:00:00.000Z',
      general_catalog: '2026-07-20T12:00:00.000Z',
      instructor_grade_archive: '2026-07-19T12:00:00.000Z',
    });
    expect(validateCatalogSnapshot(snapshot, config)).toEqual({
      success: true,
      errors: [],
    });
  });

  it('marks coverage incomplete when a configured subject is absent', () => {
    const snapshot = buildTssCatalogSnapshot(
      { ...config, configured_subjects: ['CAT', 'MATH'] },
      [
        {
          ...tssResponse,
          courses: tssResponse.courses.map((course) => ({
            ...course,
            course_title: null,
          })),
        },
      ],
      {
        runId: 'tss-fa26-partial-test',
        generatedAt: '2026-07-21T12:00:00.000Z',
        generalCatalog: {
          sourceTimestamp: '2026-07-20T12:00:00.000Z',
          courses: [],
        },
        gradeArchive: {
          sourceTimestamp: '2026-07-19T12:00:00.000Z',
          records: [],
        },
      },
    );

    expect(snapshot.coverage).toEqual({
      complete: false,
      continuation_needed: true,
    });
    expect(snapshot.courses[0]).toMatchObject({
      course_id: 'CAT:1',
      display_course_code: 'CAT-001',
      title: 'CAT-001',
    });
  });
});
