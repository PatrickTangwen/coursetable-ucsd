import { describe, expect, it } from 'vitest';

import {
  validateCatalogSnapshot,
  type CatalogSnapshotConfig,
} from './catalogSnapshot';
import {
  buildTssCatalogSnapshot,
  parseTssScheduleArtifact,
} from './tssSchedule';

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

const sourceNeutralTssResponse = {
  schema_version: 'tss-schedule-v1',
  term: 'FA26',
  captured_at: '2026-07-21T16:05:00.000Z',
  source_updated_at: '2026-07-21T09:00:00-07:00',
  source_updated_at_provenance: 'source_declared',
  source_term: {
    academic_year: '2026',
    academic_period: '2',
  },
  coverage: {
    requested_subjects: ['CAT'],
    confirmed_empty_subjects: [],
    field_coverage: {
      department_notes: 'captured',
      course_notes: 'captured',
      enrollment_requirements: 'captured',
    },
    complete: true,
    continuation_needed: false,
    omitted_courses: [],
    source_counts: {
      modules: { received: 1, declared_total: 1, pages: 1 },
      events: { received: 2, declared_total: 2, pages: 1 },
    },
  },
  courses: [
    {
      module_id: '8509',
      course_code: '001',
      course_title: 'Culture, Art, and Technology 1',
      tss_course_code: 'CAT-001',
      units: '4',
      delivery_mode: { code: 'IP', text: 'In Person' },
      description: 'TSS Schedule description.',
      department_notes: ['Department note.'],
      course_notes: ['Course note.'],
      enrollment_requirements: [
        { id: 'root', parent_id: null, text: 'Allowed classifications' },
        { id: 'freshman', parent_id: 'root', text: 'Freshman' },
      ],
      booking_choices: [
        {
          package_id: '154333',
          package_display_id: 'SE00154333',
          package_display_text: 'CAT-001 (P-001-001)',
          display_status_text: 'Entry successfully validated',
          disabled: false,
          enrollment: {
            capacity: 100,
            seats_available: 60,
            waitlist: { state: 'available', count: 0 },
          },
          components: [
            {
              teaching_method: { code: 'LE', text: 'Lecture' },
              section_code: '001-000',
              event_id: '00000665',
              event_object_id: '665',
              event_key: '001',
              status: 'Scheduled',
              begin_date: '2026-09-24',
              end_date: '2026-12-12',
              schedule_display:
                'Tu, Th 09:00 AM - 10:20 AM In Person @ Center Hall Room 101',
              meetings: [
                {
                  meeting_kind: 'class',
                  specific_date: null,
                  days: 'T R',
                  start_time: '09:00am',
                  end_time: '10:20am',
                  location_displayed: 'Center Hall Room 101',
                  modality: 'In Person',
                  instructor: 'Test Instructor',
                  is_tba: false,
                  is_arranged: false,
                },
                {
                  meeting_kind: 'final',
                  specific_date: '2026-12-10',
                  days: null,
                  start_time: '08:00am',
                  end_time: '10:59am',
                  location_displayed: null,
                  modality: 'In Person',
                  instructor: 'Test Instructor',
                  is_tba: false,
                  is_arranged: false,
                },
              ],
            },
            {
              teaching_method: { code: 'DI', text: 'Discussion' },
              section_code: '001-001',
              event_id: '00003991',
              event_object_id: '3991',
              event_key: '001',
              status: 'Scheduled',
              begin_date: '2026-09-24',
              end_date: '2026-12-12',
              schedule_display:
                'W 01:00 PM - 01:50 PM In Person @ Center Hall Room 214',
              meetings: [
                {
                  meeting_kind: 'class',
                  specific_date: null,
                  days: 'W',
                  start_time: '01:00pm',
                  end_time: '01:50pm',
                  location_displayed: 'Center Hall Room 214',
                  modality: 'In Person',
                  instructor: 'Test Instructor',
                  is_tba: false,
                  is_arranged: false,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('TSS Catalog Snapshot pipeline input', () => {
  it('preserves TSS package and event identity without WebReg renumbering', () => {
    const snapshot = buildTssCatalogSnapshot(
      config,
      [sourceNeutralTssResponse],
      {
        runId: 'tss-fa26-source-package-test',
        generatedAt: '2026-07-21T16:10:00.000Z',
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

    expect(snapshot.courses[0]).toMatchObject({
      course_id: 'CAT:1',
      units: '4',
      description: 'TSS Schedule description.',
      delivery_mode: 'In Person',
      department_notes: ['Department note.'],
      course_notes: ['Course note.'],
      enrollment_requirements: [
        { id: 'root', parent_id: null, text: 'Allowed classifications' },
        { id: 'freshman', parent_id: 'root', text: 'Freshman' },
      ],
      sections: [
        {
          section_id: 'FA26:154333',
          section_code: 'CAT-001 (P-001-001)',
          source_package_id: '154333',
          source_package_display_id: 'SE00154333',
          source_package_status_text: 'Entry successfully validated',
          source_disabled: false,
          enrolled: null,
          capacity: 100,
          available_seats: 60,
          waitlist_count: 0,
          meetings: [
            expect.objectContaining({
              source_section_code: '001-000',
              source_event_id: '00000665',
              source_event_status: 'Scheduled',
              modality: 'In Person',
              meeting_type: 'Lecture',
            }),
            expect.objectContaining({
              source_section_code: '001-000',
              source_event_id: '00000665',
              meeting_type: 'Final',
              date: '2026-12-10',
            }),
            expect.objectContaining({
              source_section_code: '001-001',
              source_event_id: '00003991',
              meeting_type: 'Discussion',
            }),
          ],
        },
      ],
    });
  });

  it('combines matching TSS component meetings across weekdays', () => {
    const response = structuredClone(tssResponse);
    const lecture = response.courses[0]!.booking_choices[0]!.components[0]!;
    const baseMeeting = lecture.meetings[0]!;
    lecture.meetings = ['F', 'M', 'W'].map((days) => ({
      ...baseMeeting,
      days,
      instructor: days === 'W' ? 'Grace Hopper' : baseMeeting.instructor,
    }));

    const snapshot = buildTssCatalogSnapshot(config, [response], {
      runId: 'tss-fa26-combined-weekdays-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [],
      },
    });

    expect(snapshot.courses[0]?.sections[0]?.meetings).toEqual([
      expect.objectContaining({
        days: ['Monday', 'Wednesday', 'Friday'],
        meeting_type: 'Lecture',
        raw_days: 'MWF',
        start_time: '11:00',
        end_time: '11:50',
        raw_location: 'PRICE THTRE',
      }),
    ]);
    expect(snapshot.courses[0]?.sections[0]?.instructors).toEqual([
      'Phoebe Bronstein',
      'Grace Hopper',
    ]);
  });

  it('keeps matching component meetings separate outside FA26', () => {
    const response = structuredClone(tssResponse);
    response.term = 'SP26';
    const lecture = response.courses[0]!.booking_choices[0]!.components[0]!;
    const baseMeeting = lecture.meetings[0]!;
    lecture.meetings = ['F', 'M', 'W'].map((days) => ({
      ...baseMeeting,
      days,
    }));

    const snapshot = buildTssCatalogSnapshot(
      {
        ...config,
        active_planning_term: 'SP26',
        term_label: 'Spring 2026',
      },
      [response],
      {
        runId: 'tss-sp26-separate-weekdays-test',
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

    expect(snapshot.courses[0]?.sections[0]?.meetings).toMatchObject([
      { days: ['Friday'], raw_days: 'F' },
      { days: ['Monday'], raw_days: 'M' },
      { days: ['Wednesday'], raw_days: 'W' },
    ]);
  });

  it('keeps same-type component meetings separate when their schedule differs', () => {
    const response = structuredClone(tssResponse);
    const lecture = response.courses[0]!.booking_choices[0]!.components[0]!;
    const baseMeeting = lecture.meetings[0]!;
    lecture.meetings = [
      { ...baseMeeting, days: 'M' },
      { ...baseMeeting, days: 'W', location_displayed: 'CENTR 101' },
    ];

    const snapshot = buildTssCatalogSnapshot(config, [response], {
      runId: 'tss-fa26-distinct-schedules-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [],
      },
    });

    expect(snapshot.courses[0]?.sections[0]?.meetings).toMatchObject([
      { days: ['Monday'], raw_location: 'PRICE THTRE' },
      { days: ['Wednesday'], raw_location: 'CENTR 101' },
    ]);
  });

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
          available_seats: 56,
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

  it('keeps package seats unknown when any required component is unknown', () => {
    const response = structuredClone(tssResponse);
    const choice = response.courses[0]!.booking_choices[0]!;
    const lecture = choice.components[0]!;
    Object.assign(lecture.enrollment, { seats_available: null });
    choice.components.push({
      ...structuredClone(lecture),
      section_code: '001-001-DI',
      event_id: 'E 00000669',
      enrollment: {
        ...lecture.enrollment,
        seats_available: 16,
      },
    });

    const snapshot = buildTssCatalogSnapshot(config, [response], {
      runId: 'tss-fa26-unknown-component-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [],
      },
    });

    expect(snapshot.courses[0]?.sections[0]?.available_seats).toBeNull();
  });

  it('publishes TSS sentinel limits as effectively unbounded availability', () => {
    const response = structuredClone(tssResponse);
    Object.assign(
      response.courses[0]!.booking_choices[0]!.components[0]!.enrollment,
      {
        enrolled: 0,
        capacity: null,
        seats_available: 9999,
      },
    );

    const snapshot = buildTssCatalogSnapshot(config, [response], {
      runId: 'tss-fa26-unbounded-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [],
      },
    });

    expect(snapshot.courses[0]?.sections[0]).toMatchObject({
      enrolled: 0,
      capacity: null,
      available_seats: null,
      capacity_kind: 'effectively_unbounded',
      reported_capacity: null,
      reported_seats_available: 9999,
    });
    expect(validateCatalogSnapshot(snapshot, config)).toEqual({
      success: true,
      errors: [],
    });
  });

  it('distinguishes zero offerings from incomplete or omitted requested data', () => {
    const sources = {
      runId: 'tss-fa26-requested-subjects-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
      generalCatalog: {
        sourceTimestamp: '2026-07-20T12:00:00.000Z',
        courses: [],
      },
      gradeArchive: {
        sourceTimestamp: '2026-07-19T12:00:00.000Z',
        records: [],
      },
    };
    const completeSnapshot = buildTssCatalogSnapshot(
      { ...config, configured_subjects: ['CAT', 'MATH'] },
      [
        {
          ...tssResponse,
          requested_course: 'CAT, MATH',
          coverage: { complete: true, continuation_needed: false },
        },
      ],
      sources,
    );
    const incompleteSnapshot = buildTssCatalogSnapshot(
      { ...config, configured_subjects: ['CAT', 'MATH'] },
      [
        {
          ...tssResponse,
          requested_course: 'CAT, MATH',
          coverage: { complete: false, continuation_needed: true },
        },
      ],
      sources,
    );
    const omittedSnapshot = buildTssCatalogSnapshot(
      { ...config, configured_subjects: ['CAT', 'MATH'] },
      [
        {
          ...tssResponse,
          requested_course: 'CAT, MATH',
          coverage: {
            complete: true,
            continuation_needed: false,
            omitted_courses: ['MATH-299'],
          },
        },
      ],
      sources,
    );

    expect(completeSnapshot.coverage).toEqual({
      complete: true,
      continuation_needed: false,
    });
    expect(incompleteSnapshot.coverage).toEqual({
      complete: false,
      continuation_needed: true,
    });
    expect(omittedSnapshot.coverage).toEqual({
      complete: false,
      continuation_needed: true,
    });
  });

  it('rejects a source term that does not map to FA26', () => {
    const response = structuredClone(sourceNeutralTssResponse);
    response.source_term.academic_period = '3';

    expect(() => parseTssScheduleArtifact(response)).toThrow(
      /FA26 source term/u,
    );
  });

  it('rejects semantic status, freshness, and parity-coverage drift at the artifact boundary', () => {
    const statusDrift = structuredClone(sourceNeutralTssResponse);
    statusDrift.courses[0]!.booking_choices[0]!.components[0]!.status =
      'Mystery';
    expect(() => parseTssScheduleArtifact(statusDrift)).toThrow();

    const freshnessDrift = structuredClone(sourceNeutralTssResponse) as {
      source_updated_at: string;
    };
    freshnessDrift.source_updated_at = 'today';
    expect(() => parseTssScheduleArtifact(freshnessDrift)).toThrow();

    const parityGap = structuredClone(sourceNeutralTssResponse);
    parityGap.coverage.field_coverage.course_notes = 'not_captured';
    expect(() => parseTssScheduleArtifact(parityGap)).toThrow(
      /UI parity field/u,
    );
  });

  it('does not treat legacy display text as verified source freshness', () => {
    const response = structuredClone(tssResponse);
    response.source_metadata.last_refreshed_displayed = 'today';

    expect(parseTssScheduleArtifact(response).source_updated_at).toBeNull();
  });
});
