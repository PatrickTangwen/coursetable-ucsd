import { describe, expect, it } from 'vitest';

import {
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
  events: {
    rows: {
      AcPeriod: string;
      InstructorEmail?: string;
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

    expect(() => sanitizeTssODataCapture(unsafe)).toThrow(/unrecognized key/iu);
  });

  it('fails closed on term drift, unsupported event status, and unknown schedule grammar', () => {
    const termDrift = mutableCapture();
    termDrift.events.rows[0]!.AcPeriod = '3';
    expect(() => sanitizeTssODataCapture(termDrift)).toThrow(/source term/u);

    const statusDrift = mutableCapture();
    statusDrift.events.rows[0]!.Status = 'Mystery';
    expect(() => sanitizeTssODataCapture(statusDrift)).toThrow();

    const scheduleDrift = mutableCapture();
    scheduleDrift.events.rows[0]!.Sched = 'Unknown schedule display';
    expect(() => sanitizeTssODataCapture(scheduleDrift)).toThrow(
      /unsupported TSS schedule line/u,
    );
  });
});
