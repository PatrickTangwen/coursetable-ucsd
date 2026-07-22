import { describe, expect, it } from 'vitest';

import { thrownBy } from './testFailure';
import {
  TSS_STRUCTURAL_DRIFT_SCHEMA_VERSION,
  TssStructuralDriftError,
  assertApprovedTssResponseUrl,
  buildTssODataRequests,
  sanitizeTssODataCapture,
} from './tssODataCapture';
import { parseTssScheduleArtifact } from './tssSchedule';

const capture = {
  term: 'FA26',
  sourceTerm: { academicYear: '2026', academicPeriod: '2' },
  requestedSubjects: ['CAT'],
  capturedAt: '2026-07-21T16:05:00.000Z',
  sourceUpdatedAt: null,
  sourceUpdatedAtProvenance: 'unavailable',
  modules: {
    declaredTotal: 1,
    pages: 1,
    continuationNeeded: false,
    rows: [
      {
        AcademicYear: '2026',
        AcademicPeriod: '2',
        ModuleID: '8509',
        CourseAbbr: 'CAT-001',
        CourseTitle: 'Culture, Art, and Technology 1',
        CreditsDisplay: '4',
        Description: 'TSS Schedule description.',
        DeliveryMode: 'In Person',
      },
    ],
  },
  events: {
    declaredTotal: 2,
    pages: 1,
    continuationNeeded: false,
    rows: [
      {
        AcYear: '2026',
        AcPeriod: '2',
        ModuleID: '8509',
        EventID: '00000665',
        EventObjid: '665',
        BeginDate: '2026-09-24',
        EndDate: '2026-12-12',
        TeachingMethod: 'LE',
        TeachingMethod_Text: 'Lecture',
        EventKey: '001',
        InstructorName: 'Test Instructor',
        LocationText: 'Center Hall Room 101',
        Status: 'Scheduled',
        EventAbbr: '001-000',
        Sched:
          'Tu, Th 09:00 AM - 10:20 AM In Person @ Center Hall Room 101\nFinal Examination 12/10/2026 08:00 AM - 10:59 AM In Person',
        EventPkgObjid: '154333',
        EventPkgDisplayID: 'SE00154333',
        EventPkgText: 'CAT-001 (P-001-001)',
        EventPkgLimit: 100,
        EventPkgSeatsAvailable: 60,
        EventPkgNumOnWaitl: 0,
        EventPkgDisable: '',
        EventPkgStatusText: 'Entry validated',
      },
      {
        AcYear: '2026',
        AcPeriod: '2',
        ModuleID: '8509',
        EventID: '00003991',
        EventObjid: '3991',
        BeginDate: '2026-09-24',
        EndDate: '2026-12-12',
        TeachingMethod: 'DI',
        TeachingMethod_Text: 'Discussion',
        EventKey: '001',
        InstructorName: 'Test Instructor',
        LocationText: 'Center Hall Room 214',
        Status: 'Scheduled',
        EventAbbr: '001-001',
        Sched: 'W 01:00 PM - 01:50 PM In Person @ Center Hall Room 214',
        EventPkgObjid: '154333',
        EventPkgDisplayID: 'SE00154333',
        EventPkgText: 'CAT-001 (P-001-001)',
        EventPkgLimit: 100,
        EventPkgSeatsAvailable: 60,
        EventPkgNumOnWaitl: 0,
        EventPkgDisable: '',
        EventPkgStatusText: 'Entry validated',
      },
    ],
  },
} as const;

type MutableCapture = {
  requestedSubjects: string[];
  modules: {
    rows: {
      CourseAbbr: string;
    }[];
  };
  events: {
    rows: {
      AcPeriod: string;
      EventPkgLimit: number | string;
      InstructorEmail?: string;
      ModuleID: string;
      Sched: string;
      Status: string;
    }[];
  };
};

function mutableCapture(): MutableCapture {
  return structuredClone(capture) as unknown as MutableCapture;
}

describe('TSS OData capture boundary', () => {
  it('builds bounded term-scoped requests that never select student or instructor-email fields', () => {
    const requests = buildTssODataRequests(capture.sourceTerm, 250);

    expect(requests).toHaveLength(2);
    for (const request of requests) {
      const url = new URL(request.url);
      expect(url.origin).toBe('https://tss.ucsd.edu');
      expect(request.method).toBe('GET');
      expect(url.searchParams.get('$count')).toBe('true');
      expect(url.searchParams.get('$top')).toBe('250');
      expect(url.searchParams.get('$select')).not.toContain('InstructorEmail');
      expect(url.pathname).not.toContain('STUDENT');
    }
    expect(new URL(requests[0]!.url).searchParams.get('$filter')).toBe(
      "AcademicYear eq '2026' and AcademicPeriod eq '2'",
    );
    expect(new URL(requests[1]!.url).searchParams.get('$filter')).toBe(
      "AcYear eq '2026' and AcPeriod eq '2'",
    );
  });

  it('sanitizes rows in memory while preserving real package and event identity', () => {
    const artifact = sanitizeTssODataCapture(capture);

    expect(artifact.coverage).toMatchObject({
      complete: false,
      field_coverage: {
        department_notes: 'not_captured',
        course_notes: 'not_captured',
        enrollment_requirements: 'not_captured',
      },
    });
    expect(artifact).toMatchObject({
      captured_at: '2026-07-21T16:05:00.000Z',
      source_updated_at: null,
      source_updated_at_provenance: 'unavailable',
    });
    expect(parseTssScheduleArtifact(artifact)).toMatchObject({
      term: 'FA26',
      courses: [
        {
          module_id: '8509',
          tss_course_code: 'CAT-001',
          booking_choices: [
            {
              package_id: '154333',
              enrollment: {
                capacity: 100,
                seats_available: 60,
                waitlist: { state: 'available', count: 0 },
              },
              components: [
                {
                  event_id: '00000665',
                  section_code: '001-000',
                  meetings: [
                    expect.objectContaining({
                      days: 'T R',
                      modality: 'In Person',
                    }),
                    expect.objectContaining({
                      meeting_kind: 'final',
                      specific_date: '2026-12-10',
                    }),
                  ],
                },
                { event_id: '00003991', section_code: '001-001' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('rejects an unselected personal field instead of silently dropping it', () => {
    const unsafe = mutableCapture();
    unsafe.events.rows[0]!.InstructorEmail = 'student-or-staff@example.edu';

    const error = thrownBy(() => sanitizeTssODataCapture(unsafe));

    expect(error).toBeInstanceOf(TssStructuralDriftError);
    expect((error as TssStructuralDriftError).report).toEqual({
      schema_version: TSS_STRUCTURAL_DRIFT_SCHEMA_VERSION,
      contract: 'tss-odata-capture-v1',
      issues: [
        {
          kind: 'path',
          path: ['events', 'rows', 0],
          expected: 'known_fields_only',
          observed: ['InstructorEmail'],
        },
      ],
    });
    expect(JSON.stringify(error)).not.toContain('student-or-staff@example.edu');
  });

  it('reports endpoint, type, and enum drift without echoing source values', () => {
    const secret = 'private-student-value-987';

    const endpointError = thrownBy(() =>
      assertApprovedTssResponseUrl(
        'https://tss.ucsd.edu/approved',
        `https://unexpected.example/${secret}`,
      ),
    );

    const typeDrift = mutableCapture();
    typeDrift.events.rows[0]!.EventPkgLimit = secret;
    const typeError = thrownBy(() => sanitizeTssODataCapture(typeDrift));

    const enumDrift = mutableCapture();
    enumDrift.events.rows[0]!.Status = secret;
    const enumError = thrownBy(() => sanitizeTssODataCapture(enumDrift));

    expect(endpointError).toBeInstanceOf(TssStructuralDriftError);
    expect(typeError).toBeInstanceOf(TssStructuralDriftError);
    expect(enumError).toBeInstanceOf(TssStructuralDriftError);
    expect((endpointError as TssStructuralDriftError).report.issues).toEqual([
      {
        kind: 'endpoint',
        path: ['response', 'url'],
        expected: 'exact_approved_request',
      },
    ]);
    expect((typeError as TssStructuralDriftError).report.issues).toContainEqual(
      {
        kind: 'type',
        path: ['events', 'rows', 0, 'EventPkgLimit'],
        expected: 'number',
      },
    );
    expect((enumError as TssStructuralDriftError).report.issues).toContainEqual(
      {
        kind: 'enum',
        path: ['events', 'rows', 0, 'Status'],
        expected: 'approved_enum_member',
      },
    );
    for (const error of [endpointError, typeError, enumError]) {
      expect(JSON.stringify(error)).not.toContain(secret);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('fails closed on term drift, unsupported event status, and unknown schedule grammar', () => {
    const termDrift = mutableCapture();
    termDrift.events.rows[0]!.AcPeriod = '3';
    expect(
      (
        thrownBy(() =>
          sanitizeTssODataCapture(termDrift),
        ) as TssStructuralDriftError
      ).report.issues,
    ).toContainEqual({
      kind: 'enum',
      path: ['events', 'rows', 0, 'AcPeriod'],
      expected: 'source_term',
    });

    const statusDrift = mutableCapture();
    statusDrift.events.rows[0]!.Status = 'Mystery';
    expect(thrownBy(() => sanitizeTssODataCapture(statusDrift))).toBeInstanceOf(
      TssStructuralDriftError,
    );

    const scheduleDrift = mutableCapture();
    scheduleDrift.events.rows[0]!.Sched = 'Unknown schedule display';
    expect(
      (
        thrownBy(() =>
          sanitizeTssODataCapture(scheduleDrift),
        ) as TssStructuralDriftError
      ).report.issues,
    ).toContainEqual({
      kind: 'type',
      path: ['events', 'rows', 'Sched'],
      expected: 'approved_schedule_grammar',
    });
  });

  it('reports ambiguous identity and package relationships as structural drift', () => {
    const cases: {
      capture: MutableCapture;
      issue: {
        kind: string;
        path: (string | number)[];
        expected: string;
      };
    }[] = [];

    const unknownModule = mutableCapture();
    unknownModule.events.rows[0]!.ModuleID = 'missing-module';
    cases.push({
      capture: unknownModule,
      issue: {
        kind: 'path',
        path: ['events', 'rows', 'ModuleID'],
        expected: 'known_module_reference',
      },
    });

    const unexpectedSubject = mutableCapture();
    unexpectedSubject.modules.rows[0]!.CourseAbbr = 'DOG-001';
    cases.push({
      capture: unexpectedSubject,
      issue: {
        kind: 'enum',
        path: ['modules', 'rows', 'CourseAbbr'],
        expected: 'requested_subject',
      },
    });

    const invalidCourse = mutableCapture();
    invalidCourse.requestedSubjects = ['CAT001'];
    invalidCourse.modules.rows[0]!.CourseAbbr = 'CAT001';
    cases.push({
      capture: invalidCourse,
      issue: {
        kind: 'type',
        path: ['modules', 'rows', 'CourseAbbr'],
        expected: 'subject_course_abbreviation',
      },
    });

    const inconsistentPackage = mutableCapture();
    inconsistentPackage.events.rows[1]!.EventPkgLimit = 99;
    cases.push({
      capture: inconsistentPackage,
      issue: {
        kind: 'path',
        path: ['events', 'rows', 'package_fields'],
        expected: 'consistent_package_fields',
      },
    });

    for (const drift of cases) {
      expect(
        (
          thrownBy(() =>
            sanitizeTssODataCapture(drift.capture),
          ) as TssStructuralDriftError
        ).report.issues,
      ).toContainEqual(drift.issue);
    }
  });
});
