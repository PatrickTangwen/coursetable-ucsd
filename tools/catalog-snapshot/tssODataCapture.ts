import { z } from 'zod';

import {
  TSS_SCHEDULE_SCHEMA_VERSION,
  tssEventStatusSchema,
  tssMeetingModalitySchema,
  tssScheduleArtifactSchema,
  type TssScheduleArtifact,
} from './tssSchedule';

const TSS_ORIGIN = 'https://tss.ucsd.edu';
const TSS_SERVICE_PATH =
  '/sap/opu/odata4/sap/yucsd_con_module_sb/srvd/sap/yucsd_con_module_servicedef/0001/';

const moduleFields = [
  'AcademicYear',
  'AcademicPeriod',
  'ModuleID',
  'CourseAbbr',
  'CourseTitle',
  'CreditsDisplay',
  'Description',
  'DeliveryMode',
] as const;

const eventFields = [
  'AcYear',
  'AcPeriod',
  'ModuleID',
  'EventID',
  'EventObjid',
  'BeginDate',
  'EndDate',
  'TeachingMethod',
  'TeachingMethod_Text',
  'EventKey',
  'InstructorName',
  'LocationText',
  'Status',
  'EventAbbr',
  'Sched',
  'EventPkgObjid',
  'EventPkgDisplayID',
  'EventPkgText',
  'EventPkgLimit',
  'EventPkgSeatsAvailable',
  'EventPkgNumOnWaitl',
  'EventPkgDisable',
  'EventPkgStatusText',
] as const;

export type TssODataRequest = {
  entity: 'modules' | 'events';
  method: 'GET';
  url: string;
};

export function buildTssODataRequests(
  sourceTerm: { academicYear: string; academicPeriod: string },
  pageSize = 250,
): TssODataRequest[] {
  if (!/^\d{4}$/u.test(sourceTerm.academicYear))
    throw new Error('invalid TSS academic year');
  if (!/^\d{1,3}$/u.test(sourceTerm.academicPeriod))
    throw new Error('invalid TSS academic period');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500)
    throw new Error('TSS page size must be an integer between 1 and 500');

  const request = (
    entity: TssODataRequest['entity'],
    entitySet: string,
    fields: readonly string[],
    filter: string,
    orderBy: string,
  ): TssODataRequest => {
    const url = new URL(`${TSS_ORIGIN}${TSS_SERVICE_PATH}${entitySet}`);
    url.searchParams.set('sap-client', '500');
    url.searchParams.set('$select', fields.join(','));
    url.searchParams.set('$filter', filter);
    url.searchParams.set('$orderby', orderBy);
    url.searchParams.set('$count', 'true');
    url.searchParams.set('$top', String(pageSize));
    return { entity, method: 'GET', url: url.toString() };
  };

  const year = sourceTerm.academicYear;
  const period = sourceTerm.academicPeriod;
  return [
    request(
      'modules',
      'YUCSD_CON_MODULE',
      moduleFields,
      `AcademicYear eq '${year}' and AcademicPeriod eq '${period}'`,
      'AcademicYear,AcademicPeriod,ModuleID',
    ),
    request(
      'events',
      'YUCSD_CON_EVENTS',
      eventFields,
      `AcYear eq '${year}' and AcPeriod eq '${period}'`,
      [
        'AcYear',
        'AcPeriod',
        'ModuleID',
        'EventPkgObjid',
        'EventID',
        'EventObjid',
        'BeginDate',
        'EndDate',
        'TeachingMethod',
        'EventKey',
        'InstructorName',
      ].join(','),
    ),
  ];
}

const moduleRowSchema = z
  .object({
    AcademicYear: z.string().min(1),
    AcademicPeriod: z.string().min(1),
    ModuleID: z.string().min(1),
    CourseAbbr: z.string().min(1),
    CourseTitle: z.string(),
    CreditsDisplay: z.string(),
    Description: z.string(),
    DeliveryMode: z.string(),
  })
  .strict();

const eventRowSchema = z
  .object({
    AcYear: z.string().min(1),
    AcPeriod: z.string().min(1),
    ModuleID: z.string().min(1),
    EventID: z.string().min(1),
    EventObjid: z.string().min(1),
    BeginDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    EndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    TeachingMethod: z.string().min(1),
    TeachingMethod_Text: z.string().min(1),
    EventKey: z.string().min(1),
    InstructorName: z.string(),
    LocationText: z.string(),
    Status: tssEventStatusSchema,
    EventAbbr: z.string().min(1),
    Sched: z.string(),
    EventPkgObjid: z.string().min(1),
    EventPkgDisplayID: z.string(),
    EventPkgText: z.string(),
    EventPkgLimit: z.number().int().nonnegative(),
    EventPkgSeatsAvailable: z.number().int().nonnegative(),
    EventPkgNumOnWaitl: z.number().int().nonnegative(),
    EventPkgDisable: z.enum(['', 'X']),
    EventPkgStatusText: z.string(),
  })
  .strict();

const captureSetSchema = <T extends z.ZodTypeAny>(rowSchema: T) =>
  z
    .object({
      declaredTotal: z.number().int().nonnegative().nullable(),
      pages: z.number().int().positive(),
      continuationNeeded: z.boolean(),
      rows: z.array(rowSchema),
    })
    .strict();

const captureSchema = z
  .object({
    term: z.literal('FA26'),
    sourceTerm: z
      .object({
        academicYear: z.literal('2026'),
        academicPeriod: z.literal('2'),
      })
      .strict(),
    requestedSubjects: z.array(z.string().regex(/^[A-Z][A-Z\d ]*$/u)).min(1),
    capturedAt: z.string().datetime({ offset: true }),
    sourceUpdatedAt: z.string().datetime({ offset: true }).nullable(),
    sourceUpdatedAtProvenance: z.enum(['source_declared', 'unavailable']),
    modules: captureSetSchema(moduleRowSchema),
    events: captureSetSchema(eventRowSchema),
  })
  .strict();

type Capture = z.infer<typeof captureSchema>;
type ModuleRow = z.infer<typeof moduleRowSchema>;
type EventRow = z.infer<typeof eventRowSchema>;
type ScheduleMeeting =
  TssScheduleArtifact['courses'][number]['booking_choices'][number]['components'][number]['meetings'][number];

const dayCodes: { [day: string]: string } = {
  F: 'F',
  M: 'M',
  Sa: 'S',
  Su: 'U',
  Th: 'R',
  Tu: 'T',
  W: 'W',
};

const regularScheduleLine = new RegExp(
  '^(?<days>(?:[MWF]|T[uh]|S[au])(?:,\\s*(?:[MWF]|T[uh]|S[au]))*)\\s+' +
    '(?<start>\\d{1,2}:\\d{2}\\s+[AP]M)\\s+-\\s+' +
    '(?<end>\\d{1,2}:\\d{2}\\s+[AP]M)\\s+' +
    '(?<modality>In Person|Online|Remote|Hybrid)$',
  'u',
);

const finalScheduleLine = new RegExp(
  '^Final (?:Exam|Examination)\\s+' +
    '(?<date>\\d{1,2}/\\d{1,2}/\\d{4})\\s+' +
    '(?<start>\\d{1,2}:\\d{2}\\s+[AP]M)\\s+-\\s+' +
    '(?<end>\\d{1,2}:\\d{2}\\s+[AP]M)\\s+' +
    '(?<modality>In Person|Online|Remote|Hybrid)$',
  'u',
);

function nullableText(value: string): string | null {
  const text = value.trim();
  return text || null;
}

function meetingTime(value: string): string {
  return value.replace(/\s+/gu, '').toLowerCase();
}

function isoDate(value: string): string {
  const [monthText, dayText, yearText] = value.split('/');
  if (!monthText || !dayText || !yearText)
    throw new Error('invalid TSS schedule date');

  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error('invalid TSS schedule date');
  return `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseSchedule(row: EventRow): ScheduleMeeting[] {
  const lines = row.Sched.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return [
      {
        meeting_kind: 'class',
        specific_date: null,
        days: null,
        start_time: null,
        end_time: null,
        location_displayed: nullableText(row.LocationText),
        modality: null,
        instructor: nullableText(row.InstructorName),
        is_tba: true,
        is_arranged: null,
      },
    ];
  }

  return lines.map((line) => {
    if (line === 'TBA' || line === 'To Be Announced' || line === 'Arranged') {
      return {
        meeting_kind: 'class',
        specific_date: null,
        days: null,
        start_time: null,
        end_time: null,
        location_displayed: nullableText(row.LocationText),
        modality: null,
        instructor: nullableText(row.InstructorName),
        is_tba: line !== 'Arranged',
        is_arranged: line === 'Arranged',
      };
    }

    const scheduleParts = line.split(' @ ');
    if (scheduleParts.length > 2)
      throw new Error('unsupported TSS schedule line');

    const [scheduleText, displayedLocation] = scheduleParts;
    if (!scheduleText) throw new Error('unsupported TSS schedule line');

    const finalMatch = finalScheduleLine.exec(scheduleText);
    if (finalMatch?.groups) {
      return {
        meeting_kind: 'final',
        specific_date: isoDate(finalMatch.groups.date!),
        days: null,
        start_time: meetingTime(finalMatch.groups.start!),
        end_time: meetingTime(finalMatch.groups.end!),
        location_displayed: nullableText(displayedLocation ?? ''),
        modality: tssMeetingModalitySchema.parse(finalMatch.groups.modality),
        instructor: nullableText(row.InstructorName),
        is_tba: false,
        is_arranged: false,
      };
    }

    const meetingMatch = regularScheduleLine.exec(scheduleText);
    if (meetingMatch?.groups) {
      const days = meetingMatch.groups
        .days!.split(/,\s*/u)
        .map((day) => dayCodes[day])
        .join(' ');
      return {
        meeting_kind: 'class',
        specific_date: null,
        days,
        start_time: meetingTime(meetingMatch.groups.start!),
        end_time: meetingTime(meetingMatch.groups.end!),
        location_displayed: nullableText(displayedLocation ?? row.LocationText),
        modality: tssMeetingModalitySchema.parse(meetingMatch.groups.modality),
        instructor: nullableText(row.InstructorName),
        is_tba: false,
        is_arranged: false,
      };
    }
    throw new Error('unsupported TSS schedule line');
  });
}

function assertSourceTerm(capture: Capture) {
  const { academicYear, academicPeriod } = capture.sourceTerm;
  for (const row of capture.modules.rows) {
    if (
      row.AcademicYear !== academicYear ||
      row.AcademicPeriod !== academicPeriod
    )
      throw new Error('module row does not match source term');
  }
  for (const row of capture.events.rows) {
    if (row.AcYear !== academicYear || row.AcPeriod !== academicPeriod)
      throw new Error('event row does not match source term');
  }
}

function samePackageFields(left: EventRow, right: EventRow): boolean {
  return [
    'EventPkgDisplayID',
    'EventPkgText',
    'EventPkgLimit',
    'EventPkgSeatsAvailable',
    'EventPkgNumOnWaitl',
    'EventPkgDisable',
    'EventPkgStatusText',
  ].every(
    (field) => left[field as keyof EventRow] === right[field as keyof EventRow],
  );
}

function courseFromModule(module: ModuleRow, events: EventRow[]) {
  const separator = module.CourseAbbr.indexOf('-');
  if (separator < 1 || separator === module.CourseAbbr.length - 1)
    throw new Error('unsupported TSS course abbreviation');
  const packages = new Map<string, EventRow[]>();
  for (const event of events) {
    const packageEvents = packages.get(event.EventPkgObjid) ?? [];
    const [first] = packageEvents;
    if (first && !samePackageFields(first, event))
      throw new Error('inconsistent package-level TSS fields');
    packageEvents.push(event);
    packages.set(event.EventPkgObjid, packageEvents);
  }

  return {
    module_id: module.ModuleID,
    course_code: module.CourseAbbr.slice(separator + 1),
    course_title: nullableText(module.CourseTitle),
    tss_course_code: module.CourseAbbr,
    units: nullableText(module.CreditsDisplay),
    delivery_mode: nullableText(module.DeliveryMode)
      ? { code: module.DeliveryMode, text: module.DeliveryMode }
      : null,
    description: nullableText(module.Description),
    department_notes: [],
    course_notes: [],
    enrollment_requirements: [],
    booking_choices: [...packages.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([packageId, packageEvents]) => {
        const source = packageEvents[0]!;
        return {
          package_id: packageId,
          package_display_id: nullableText(source.EventPkgDisplayID),
          package_display_text: nullableText(source.EventPkgText),
          status_text: nullableText(source.EventPkgStatusText),
          disabled: source.EventPkgDisable === 'X',
          enrollment: {
            capacity: source.EventPkgLimit,
            seats_available: source.EventPkgSeatsAvailable,
            waitlist: {
              state: 'available' as const,
              count: source.EventPkgNumOnWaitl,
            },
          },
          components: [...packageEvents]
            .sort((left, right) => left.EventID.localeCompare(right.EventID))
            .map((event) => ({
              teaching_method: {
                code: event.TeachingMethod,
                text: event.TeachingMethod_Text,
              },
              section_code: event.EventAbbr,
              event_id: event.EventID,
              event_object_id: event.EventObjid,
              event_key: event.EventKey,
              status: event.Status,
              begin_date: event.BeginDate,
              end_date: event.EndDate,
              schedule_display: nullableText(event.Sched),
              meetings: parseSchedule(event),
            })),
        };
      }),
  };
}

export function sanitizeTssODataCapture(input: unknown): TssScheduleArtifact {
  const capture = captureSchema.parse(input);
  assertSourceTerm(capture);

  const requestedSubjects = new Set(capture.requestedSubjects);
  const eventsByModule = new Map<string, EventRow[]>();
  for (const event of capture.events.rows) {
    const rows = eventsByModule.get(event.ModuleID) ?? [];
    rows.push(event);
    eventsByModule.set(event.ModuleID, rows);
  }

  const knownModuleIds = new Set(
    capture.modules.rows.map((row) => row.ModuleID),
  );
  for (const moduleId of eventsByModule.keys()) {
    if (!knownModuleIds.has(moduleId))
      throw new Error('TSS event references an unknown module');
  }

  const courses = [...capture.modules.rows]
    .sort((left, right) => left.CourseAbbr.localeCompare(right.CourseAbbr))
    .map((module) => {
      const subject = module.CourseAbbr.split('-', 1)[0]!;
      if (!requestedSubjects.has(subject))
        throw new Error('TSS module subject was not requested');
      return courseFromModule(
        module,
        eventsByModule.get(module.ModuleID) ?? [],
      );
    });
  const representedSubjects = new Set(
    courses.map((course) => course.tss_course_code.split('-', 1)[0]!),
  );
  const rowCoverageComplete = [capture.modules, capture.events].every(
    (set) =>
      !set.continuationNeeded &&
      set.declaredTotal !== null &&
      set.declaredTotal === set.rows.length,
  );
  const fieldCoverage: TssScheduleArtifact['coverage']['field_coverage'] = {
    department_notes: 'not_captured',
    course_notes: 'not_captured',
    enrollment_requirements: 'not_captured',
  };
  const complete =
    rowCoverageComplete &&
    Object.values(fieldCoverage).every((state) => state === 'captured');

  return tssScheduleArtifactSchema.parse({
    schema_version: TSS_SCHEDULE_SCHEMA_VERSION,
    term: capture.term,
    captured_at: capture.capturedAt,
    source_updated_at: capture.sourceUpdatedAt,
    source_updated_at_provenance: capture.sourceUpdatedAtProvenance,
    source_term: {
      academic_year: capture.sourceTerm.academicYear,
      academic_period: capture.sourceTerm.academicPeriod,
    },
    coverage: {
      complete,
      continuation_needed:
        capture.modules.continuationNeeded || capture.events.continuationNeeded,
      omitted_courses: [],
      requested_subjects: capture.requestedSubjects,
      confirmed_empty_subjects: capture.requestedSubjects.filter(
        (subject) => !representedSubjects.has(subject),
      ),
      field_coverage: fieldCoverage,
      source_counts: {
        modules: {
          received: capture.modules.rows.length,
          declared_total: capture.modules.declaredTotal,
          pages: capture.modules.pages,
        },
        events: {
          received: capture.events.rows.length,
          declared_total: capture.events.declaredTotal,
          pages: capture.events.pages,
        },
      },
    },
    courses,
  });
}
