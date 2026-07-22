import { z } from 'zod';

import {
  attachGeneralCatalogMetadata,
  attachGradeArchiveRecords,
  type CatalogSnapshot,
  type CatalogSnapshotConfig,
} from './catalogSnapshot';
import type { GeneralCatalogCourse } from './generalCatalog';
import type { GradeArchiveRecord } from './instructorGradeArchive';
import {
  buildScheduleCatalogSnapshot,
  type ParsedScheduleOfClasses,
} from './scheduleOfClasses';
import { normalizeTssMeetingDays } from '../../shared/tssMeetingDays.js';

function objectSchema<Shape extends z.ZodRawShape>(
  shape: Shape,
  rejectUnknownFields: boolean,
) {
  const schema = z.object(shape);
  return rejectUnknownFields ? schema.strict() : schema;
}

function buildLegacyCourseSchema(rejectUnknownFields: boolean) {
  const meetingSchema = objectSchema(
    {
      meeting_kind: z.string(),
      specific_date: z.string().nullable(),
      days: z.string().nullable(),
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
      location_displayed: z.string().nullable(),
      instructor: z.string().nullable(),
      is_tba: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .transform(Boolean),
      is_arranged: z.boolean().nullable(),
    },
    rejectUnknownFields,
  );
  const waitlistSchema = objectSchema(
    {
      state: z.string(),
      count: z.number().nullable(),
    },
    rejectUnknownFields,
  );
  const enrollmentSchema = objectSchema(
    {
      enrolled: z.number().nullable(),
      capacity: z.number().nullable(),
      seats_available: z.number().nullable(),
      capacity_kind: z.enum(['bounded', 'effectively_unbounded']).optional(),
      reported_capacity: z.number().nullable().optional(),
      reported_seats_available: z.number().nullable().optional(),
      waitlist: waitlistSchema,
    },
    rejectUnknownFields,
  );
  const componentSchema = objectSchema(
    {
      type: z.string(),
      section_code: z.string(),
      event_id: z.string(),
      requirement: z.string(),
      meetings: z.array(meetingSchema),
      enrollment: enrollmentSchema,
    },
    rejectUnknownFields,
  );
  const bookingChoiceSchema = objectSchema(
    {
      booking_choice_ordinal: z.number().int().positive(),
      displayed_package_section: z.string().nullable(),
      displayed_package_id: z.string().nullable(),
      components: z.array(componentSchema).min(1),
    },
    rejectUnknownFields,
  );
  return objectSchema(
    {
      course_code: z.string().min(1),
      course_title: z.string().min(1).nullable(),
      tss_course_code: z.string().min(1),
      booking_choices: z.array(bookingChoiceSchema),
    },
    rejectUnknownFields,
  );
}

function buildCoverageSchema(rejectUnknownFields: boolean) {
  return objectSchema(
    {
      complete: z.boolean(),
      continuation_needed: z.boolean(),
      omitted_courses: z.array(z.string().min(1)).optional(),
    },
    rejectUnknownFields,
  );
}

const legacyCourseSchema = buildLegacyCourseSchema(false);
const legacyCoverageSchema = buildCoverageSchema(false);

const legacyTssResponseSchema = objectSchema(
  {
    schema_version: z.literal('tss-chatbot-v1'),
    term: z.string().min(1),
    requested_course: z.string().min(1).optional(),
    source_metadata: z.object({
      last_refreshed_displayed: z.string().nullable(),
    }),
    coverage: legacyCoverageSchema,
    courses: z.array(legacyCourseSchema),
  },
  false,
);

export const TSS_SCHEDULE_SCHEMA_VERSION = 'tss-schedule-v1' as const;

const scheduleWaitlistSchema = objectSchema(
  {
    state: z.enum(['available', 'unavailable', 'not_shown']),
    count: z.number().int().nonnegative().nullable(),
  },
  true,
);

const scheduleEnrollmentSchema = objectSchema(
  {
    capacity: z.number().int().nonnegative().nullable(),
    seats_available: z.number().int().nonnegative().nullable(),
    waitlist: scheduleWaitlistSchema,
  },
  true,
);

const scheduleMeetingSchema = objectSchema(
  {
    meeting_kind: z.string().min(1),
    specific_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    days: z.string().nullable(),
    start_time: z.string().nullable(),
    end_time: z.string().nullable(),
    location_displayed: z.string().nullable(),
    modality: z.string().nullable(),
    instructor: z.string().nullable(),
    is_tba: z.boolean(),
    is_arranged: z.boolean().nullable(),
  },
  true,
);

const scheduleComponentSchema = objectSchema(
  {
    teaching_method: objectSchema(
      {
        code: z.string().min(1),
        text: z.string().min(1),
      },
      true,
    ),
    section_code: z.string().min(1),
    event_id: z.string().min(1),
    event_object_id: z.string().min(1),
    event_key: z.string().min(1),
    status: z.string().min(1),
    begin_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    schedule_display: z.string().nullable(),
    meetings: z.array(scheduleMeetingSchema),
  },
  true,
);

const schedulePackageSchema = objectSchema(
  {
    package_id: z.string().min(1),
    package_display_id: z.string().min(1).nullable(),
    package_display_text: z.string().min(1).nullable(),
    status_text: z.string().min(1).nullable(),
    disabled: z.boolean(),
    enrollment: scheduleEnrollmentSchema,
    components: z.array(scheduleComponentSchema).min(1),
  },
  true,
);

const enrollmentRequirementSchema = objectSchema(
  {
    id: z.string().min(1),
    parent_id: z.string().min(1).nullable(),
    text: z.string().min(1),
  },
  true,
);

const scheduleCourseSchema = objectSchema(
  {
    module_id: z.string().min(1),
    course_code: z.string().min(1),
    course_title: z.string().min(1).nullable(),
    tss_course_code: z.string().min(1),
    units: z.string().min(1).nullable(),
    delivery_mode: objectSchema(
      {
        code: z.string().min(1),
        text: z.string().min(1),
      },
      true,
    ).nullable(),
    description: z.string().min(1).nullable(),
    department_notes: z.array(z.string().min(1)),
    course_notes: z.array(z.string().min(1)),
    enrollment_requirements: z.array(enrollmentRequirementSchema),
    booking_choices: z.array(schedulePackageSchema),
  },
  true,
);

const sourceCountSchema = objectSchema(
  {
    received: z.number().int().nonnegative(),
    declared_total: z.number().int().nonnegative().nullable(),
    pages: z.number().int().positive(),
  },
  true,
);

const scheduleCoverageSchema = objectSchema(
  {
    complete: z.boolean(),
    continuation_needed: z.boolean(),
    omitted_courses: z.array(z.string().min(1)),
    requested_subjects: z.array(z.string().min(1)),
    confirmed_empty_subjects: z.array(z.string().min(1)),
    source_counts: objectSchema(
      {
        modules: sourceCountSchema,
        events: sourceCountSchema,
      },
      true,
    ),
  },
  true,
);

export const tssScheduleArtifactSchema = objectSchema(
  {
    schema_version: z.literal(TSS_SCHEDULE_SCHEMA_VERSION),
    term: z.string().min(1),
    captured_at: z.string().datetime({ offset: true }),
    source_updated_at: z.string().min(1).nullable(),
    source_term: objectSchema(
      {
        academic_year: z.string().min(1),
        academic_period: z.string().min(1),
      },
      true,
    ),
    coverage: scheduleCoverageSchema,
    courses: z.array(scheduleCourseSchema),
  },
  true,
).superRefine((artifact, context) => {
  const { coverage, courses } = artifact;
  if (
    artifact.term === 'FA26' &&
    (artifact.source_term.academic_year !== '2026' ||
      artifact.source_term.academic_period !== '2')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_term'],
      message: 'FA26 source term must be academic year 2026 and period 2',
    });
  }
  const componentCount = courses.reduce(
    (total, course) =>
      total +
      course.booking_choices.reduce(
        (packageTotal, choice) => packageTotal + choice.components.length,
        0,
      ),
    0,
  );
  if (coverage.source_counts.modules.received !== courses.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverage', 'source_counts', 'modules', 'received'],
      message: 'received module count must equal sanitized course count',
    });
  }
  if (coverage.source_counts.events.received !== componentCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverage', 'source_counts', 'events', 'received'],
      message: 'received event count must equal sanitized component count',
    });
  }
  if (coverage.complete) {
    if (coverage.continuation_needed || coverage.omitted_courses.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['coverage'],
        message:
          'complete coverage cannot require continuation or omit courses',
      });
    }
    for (const [name, count] of Object.entries(coverage.source_counts)) {
      if (count.declared_total !== count.received) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['coverage', 'source_counts', name, 'declared_total'],
          message:
            'complete coverage requires declared total to equal received count',
        });
      }
    }
  }

  const requestedSubjects = new Set(
    coverage.requested_subjects.map((subject) => subject.toUpperCase()),
  );
  const confirmedEmptySubjects = new Set(
    coverage.confirmed_empty_subjects.map((subject) => subject.toUpperCase()),
  );
  for (const subject of confirmedEmptySubjects) {
    if (!requestedSubjects.has(subject)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['coverage', 'confirmed_empty_subjects'],
        message: `confirmed empty subject ${subject} was not requested`,
      });
    }
  }

  const courseIds = new Set<string>();
  const moduleIds = new Set<string>();
  const packageIds = new Set<string>();
  for (const [courseIndex, course] of courses.entries()) {
    const subject = course.tss_course_code.split('-', 1)[0]!.toUpperCase();
    if (confirmedEmptySubjects.has(subject)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['courses', courseIndex, 'tss_course_code'],
        message: `confirmed empty subject ${subject} contains a course`,
      });
    }
    for (const [value, seen, name] of [
      [course.tss_course_code, courseIds, 'course'],
      [course.module_id, moduleIds, 'module'],
    ] as const) {
      if (seen.has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['courses', courseIndex],
          message: `duplicate ${name} identity ${value}`,
        });
      }
      seen.add(value);
    }
    for (const [packageIndex, choice] of course.booking_choices.entries()) {
      if (packageIds.has(choice.package_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['courses', courseIndex, 'booking_choices', packageIndex],
          message: `duplicate package identity ${choice.package_id}`,
        });
      }
      packageIds.add(choice.package_id);
      const eventIds = new Set<string>();
      for (const [componentIndex, component] of choice.components.entries()) {
        if (eventIds.has(component.event_id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              'courses',
              courseIndex,
              'booking_choices',
              packageIndex,
              'components',
              componentIndex,
            ],
            message: `duplicate event identity ${component.event_id} within package`,
          });
        }
        eventIds.add(component.event_id);
      }
    }
  }
});

export type TssScheduleArtifact = z.infer<typeof tssScheduleArtifactSchema>;

type LegacyCourse = z.infer<typeof legacyCourseSchema>;
type LegacyComponent =
  LegacyCourse['booking_choices'][number]['components'][number];
type NormalizedEnrollment = LegacyComponent['enrollment'];
type NormalizedTssMeeting = {
  meeting_kind: string;
  specific_date: string | null;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  location_displayed: string | null;
  modality: string | null;
  instructor: string | null;
  is_tba: boolean;
  is_arranged: boolean | null;
};
type NormalizedTssComponent = {
  type: string;
  section_code: string;
  event_id: string;
  event_object_id: string | null;
  event_key: string | null;
  status: string | null;
  begin_date: string | null;
  end_date: string | null;
  schedule_display: string | null;
  meetings: NormalizedTssMeeting[];
  legacy_enrollment: NormalizedEnrollment | null;
  legacy_requirement: string | null;
};
type NormalizedBookingChoice = {
  package_id: string | null;
  package_display_id: string | null;
  package_display_text: string | null;
  status_text: string | null;
  disabled: boolean | null;
  enrollment: NormalizedEnrollment | null;
  components: NormalizedTssComponent[];
};
type NormalizedTssCourse = {
  module_id: string | null;
  course_code: string;
  course_title: string | null;
  tss_course_code: string;
  units: string | null;
  delivery_mode: string | null;
  description: string | null;
  department_notes: string[];
  course_notes: string[];
  enrollment_requirements: {
    id: string;
    parent_id: string | null;
    text: string;
  }[];
  booking_choices: NormalizedBookingChoice[];
};

export type NormalizedTssScheduleArtifact = {
  schema_version: typeof TSS_SCHEDULE_SCHEMA_VERSION;
  input_schema_version: 'tss-schedule-v1' | 'tss-chatbot-v1';
  term: string;
  captured_at: string | null;
  source_updated_at: string | null;
  requested_subjects: string[];
  coverage: {
    complete: boolean;
    continuation_needed: boolean;
    omitted_courses?: string[];
  };
  courses: NormalizedTssCourse[];
};

type TssScheduleInput = NormalizedTssScheduleArtifact;
type TssCourse = NormalizedTssCourse;
type BookingChoice = TssCourse['booking_choices'][number];
type TssComponent = BookingChoice['components'][number];
type TssMeeting = TssComponent['meetings'][number];
type SnapshotCourse = CatalogSnapshot['courses'][number];
type SnapshotSection = SnapshotCourse['sections'][number];
type SnapshotMeeting = SnapshotSection['meetings'][number];

export type TssCatalogSnapshotSources = {
  runId?: string;
  generatedAt?: string;
  generalCatalog: {
    sourceTimestamp: string | null;
    courses: GeneralCatalogCourse[];
  };
  gradeArchive: {
    sourceTimestamp: string | null;
    records: GradeArchiveRecord[];
  };
};

export function parseTssRequestedSubjects(value?: string): string[] {
  return (value ?? '')
    .split(/[^A-Za-z\d]+/u)
    .map((subject) => subject.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Normalizes source-neutral sanitized artifacts and preserved chatbot-era
 * evidence into one downstream Schedule contract. Legacy evidence has no
 * trustworthy capture timestamp, so the adapter preserves that absence.
 */
export function parseTssScheduleArtifact(
  value: unknown,
): NormalizedTssScheduleArtifact {
  const parsed = z
    .union([tssScheduleArtifactSchema, legacyTssResponseSchema])
    .parse(value);
  if (parsed.schema_version === TSS_SCHEDULE_SCHEMA_VERSION) {
    const {
      requested_subjects: requestedSubjects,
      confirmed_empty_subjects: _confirmedEmptySubjects,
      source_counts: _sourceCounts,
      ...coverage
    } = parsed.coverage;
    return {
      schema_version: parsed.schema_version,
      input_schema_version: parsed.schema_version,
      term: parsed.term,
      captured_at: parsed.captured_at,
      source_updated_at: parsed.source_updated_at,
      requested_subjects: requestedSubjects,
      coverage,
      courses: parsed.courses.map((course) => ({
        module_id: course.module_id,
        course_code: course.course_code,
        course_title: course.course_title,
        tss_course_code: course.tss_course_code,
        units: course.units,
        delivery_mode: course.delivery_mode?.text ?? null,
        description: course.description,
        department_notes: course.department_notes,
        course_notes: course.course_notes,
        enrollment_requirements: course.enrollment_requirements,
        booking_choices: course.booking_choices.map((choice) => ({
          package_id: choice.package_id,
          package_display_id: choice.package_display_id,
          package_display_text: choice.package_display_text,
          status_text: choice.status_text,
          disabled: choice.disabled,
          enrollment: {
            enrolled: null,
            capacity: choice.enrollment.capacity,
            seats_available: choice.enrollment.seats_available,
            waitlist: choice.enrollment.waitlist,
          },
          components: choice.components.map((component) => ({
            type: component.teaching_method.text,
            section_code: component.section_code,
            event_id: component.event_id,
            event_object_id: component.event_object_id,
            event_key: component.event_key,
            status: component.status,
            begin_date: component.begin_date,
            end_date: component.end_date,
            schedule_display: component.schedule_display,
            meetings: component.meetings,
            legacy_enrollment: null,
            legacy_requirement: null,
          })),
        })),
      })),
    };
  }
  return {
    schema_version: TSS_SCHEDULE_SCHEMA_VERSION,
    input_schema_version: parsed.schema_version,
    term: parsed.term,
    captured_at: null,
    source_updated_at: parsed.source_metadata.last_refreshed_displayed,
    requested_subjects: parseTssRequestedSubjects(parsed.requested_course),
    coverage: parsed.coverage,
    courses: parsed.courses.map((course) => ({
      module_id: null,
      course_code: course.course_code,
      course_title: course.course_title,
      tss_course_code: course.tss_course_code,
      units: null,
      delivery_mode: null,
      description: null,
      department_notes: [],
      course_notes: [],
      enrollment_requirements: [],
      booking_choices: course.booking_choices.map((choice) => ({
        package_id: choice.displayed_package_id,
        package_display_id: choice.displayed_package_id,
        package_display_text: choice.displayed_package_section,
        status_text: null,
        disabled: null,
        enrollment: null,
        components: choice.components.map((component) => ({
          type: component.type,
          section_code: component.section_code,
          event_id: component.event_id,
          event_object_id: null,
          event_key: null,
          status: null,
          begin_date: null,
          end_date: null,
          schedule_display: null,
          meetings: component.meetings.map((meeting) => ({
            ...meeting,
            modality: null,
          })),
          legacy_enrollment: component.enrollment,
          legacy_requirement: component.requirement,
        })),
      })),
    })),
  };
}

const dayNames: { [day: string]: string } = {
  F: 'Friday',
  M: 'Monday',
  R: 'Thursday',
  S: 'Saturday',
  T: 'Tuesday',
  U: 'Sunday',
  W: 'Wednesday',
};

const rawDayNames: { [day: string]: string } = {
  F: 'F',
  M: 'M',
  R: 'Th',
  S: 'Sa',
  T: 'Tu',
  U: 'Su',
  W: 'W',
};

const meetingTypeLabels: { [type: string]: string } = {
  cl: 'Clinical',
  discussion: 'Discussion',
  fw: 'Fieldwork',
  in: 'Independent Study',
  'independent study': 'Independent Study',
  lab: 'Laboratory',
  lecture: 'Lecture',
  pr: 'Practicum',
  se: 'Seminar',
  tu: 'Tutorial',
};

function sourceIdentifier(value: string): string {
  return value.trim().replace(/\s+/gu, '');
}

function normalizeCourseNumber(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/u, '');
}

function courseIdentity(course: TssCourse) {
  const separator = course.tss_course_code.indexOf('-');
  const subject = (
    separator >= 0
      ? course.tss_course_code.slice(0, separator)
      : course.tss_course_code
  )
    .trim()
    .toUpperCase();
  const courseNumber = normalizeCourseNumber(
    separator >= 0
      ? course.tss_course_code.slice(separator + 1)
      : course.course_code,
  );
  return {
    subject,
    courseNumber,
    courseId: `${subject}:${courseNumber}`,
  };
}

export function tssCourseIds(responses: unknown[]): Set<string> {
  return new Set(
    responses.flatMap((response) =>
      parseTssScheduleArtifact(response).courses.map(
        (course) => courseIdentity(course).courseId,
      ),
    ),
  );
}

function sectionId(
  term: string,
  course: TssCourse,
  choice: BookingChoice,
): string {
  if (choice.package_id)
    return `${term}:${sourceIdentifier(choice.package_id)}`;
  const componentIds = choice.components.map((component) =>
    sourceIdentifier(component.event_id),
  );
  return `${term}:${sourceIdentifier(course.tss_course_code)}:${componentIds.join('+')}`;
}

function sectionCode(choice: BookingChoice): string {
  return (
    choice.package_display_text ??
    choice.package_display_id ??
    choice.components.map((component) => component.section_code).join(' + ')
  );
}

function sectionMeetingType(choice: BookingChoice): string {
  const types = new Set(choice.components.map((component) => component.type));
  if (types.size !== 1) return 'Package';
  const [type = 'Meeting'] = types;
  return type.length <= 3 ? type.toUpperCase() : type;
}

function dayTokens(value: string | null): string[] {
  return (value ?? '')
    .trim()
    .split(/\s+/u)
    .filter((day) => Boolean(dayNames[day]));
}

function time24(value: string | null): string | null {
  if (!value) return null;
  const match = /^(?<hour>\d{1,2}):(?<minute>\d{2})(?<period>am|pm)$/iu.exec(
    value.trim(),
  );
  const hourText = match?.groups?.hour;
  const minute = match?.groups?.minute;
  const period = match?.groups?.period?.toLowerCase();
  if (!hourText || !minute || !period) return null;
  let hour = Number(hourText) % 12;
  if (period === 'pm') hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function locationParts(value: string | null) {
  const location = value?.trim() ?? '';
  if (!location || /^tba$/iu.test(location))
    return { building: null, room: null };
  const separator = location.indexOf(' ');
  if (separator < 0) return { building: location, room: null };
  return {
    building: location.slice(0, separator),
    room: location.slice(separator + 1),
  };
}

function toMeeting(
  component: TssComponent,
  meeting: TssMeeting,
): SnapshotMeeting {
  const tokens = dayTokens(meeting.days);
  const startTime = time24(meeting.start_time);
  const endTime = time24(meeting.end_time);
  const { building, room } = locationParts(meeting.location_displayed);
  const meetingType =
    meeting.meeting_kind === 'final'
      ? 'Final'
      : meeting.meeting_kind === 'midterm'
        ? 'Midterm'
        : (meetingTypeLabels[component.type.toLowerCase()] ?? component.type);
  return {
    days: tokens.map((day) => dayNames[day]!),
    date: meeting.specific_date,
    start_time: startTime,
    end_time: endTime,
    building,
    room,
    is_tba:
      meeting.is_tba ||
      meeting.is_arranged === true ||
      !startTime ||
      !endTime ||
      (!meeting.specific_date && tokens.length === 0),
    meeting_type: meetingType,
    raw_days: tokens.map((day) => rawDayNames[day]).join('') || null,
    raw_time:
      meeting.start_time && meeting.end_time
        ? `${meeting.start_time}-${meeting.end_time}`
        : null,
    raw_location: meeting.location_displayed,
    source_section_code: component.section_code,
    source_event_id: component.event_id,
    source_event_status: component.status,
    modality: meeting.modality,
  };
}

function choiceEnrollment(choice: BookingChoice) {
  const exact = choice.enrollment;
  if (exact) {
    const exactIsUnbounded =
      exact.capacity_kind === 'effectively_unbounded' ||
      exact.capacity === 9999 ||
      exact.capacity === 99999 ||
      exact.seats_available === 9999 ||
      exact.seats_available === 99999;
    return {
      enrolled:
        exact.enrolled === 9999 || exact.enrolled === 99999
          ? null
          : exact.enrolled,
      capacity: exactIsUnbounded ? null : exact.capacity,
      availableSeats: exactIsUnbounded ? null : exact.seats_available,
      capacityKind: exactIsUnbounded
        ? ('effectively_unbounded' as const)
        : exact.capacity !== null || exact.seats_available !== null
          ? ('bounded' as const)
          : undefined,
      reportedCapacity: exactIsUnbounded ? exact.capacity : undefined,
      reportedSeatsAvailable: exactIsUnbounded
        ? exact.seats_available
        : undefined,
      waitlistCount: exact.waitlist.count,
    };
  }

  const availableComponents = choice.components.flatMap((component) =>
    component.legacy_enrollment
      ? [{ component, enrollment: component.legacy_enrollment }]
      : [],
  );
  const required = availableComponents.filter(
    ({ component }) => component.legacy_requirement === 'required',
  );
  const components = required.length ? required : availableComponents;
  const isUnbounded = ({ enrollment }: (typeof components)[number]) =>
    enrollment.capacity_kind === 'effectively_unbounded' ||
    enrollment.capacity === 9999 ||
    enrollment.capacity === 99999 ||
    enrollment.seats_available === 9999 ||
    enrollment.seats_available === 99999;
  const allSeatsKnown = components.every(
    (component) =>
      isUnbounded(component) || component.enrollment.seats_available !== null,
  );
  const boundedComponents = components.filter(
    (component) => !isUnbounded(component),
  );
  const limiting = (allSeatsKnown ? boundedComponents : []).reduce<
    (typeof components)[number] | null
  >((current, item) => {
    if (!current) return item;
    return item.enrollment.seats_available! <
      current.enrollment.seats_available!
      ? item
      : current;
  }, null);
  const waitlistCounts = components.flatMap(({ enrollment }) => {
    const { count } = enrollment.waitlist;
    return count === null ? [] : [count];
  });
  const allUnbounded =
    allSeatsKnown && components.every((component) => isUnbounded(component));
  const reportedUnbounded = allUnbounded ? components[0] : null;
  const unboundedEnrolled = allUnbounded
    ? components
        .map(({ enrollment }) => enrollment.enrolled)
        .filter(
          (value): value is number =>
            value !== null && value !== 9999 && value !== 99999,
        )
    : [];
  return {
    enrolled: allUnbounded
      ? unboundedEnrolled.length
        ? Math.max(...unboundedEnrolled)
        : null
      : (limiting?.enrollment.enrolled ?? null),
    capacity: allUnbounded ? null : (limiting?.enrollment.capacity ?? null),
    availableSeats: allUnbounded
      ? null
      : (limiting?.enrollment.seats_available ?? null),
    capacityKind: allUnbounded
      ? ('effectively_unbounded' as const)
      : limiting
        ? ('bounded' as const)
        : undefined,
    reportedCapacity: reportedUnbounded
      ? (reportedUnbounded.enrollment.reported_capacity ??
        reportedUnbounded.enrollment.capacity)
      : undefined,
    reportedSeatsAvailable: reportedUnbounded
      ? (reportedUnbounded.enrollment.reported_seats_available ??
        reportedUnbounded.enrollment.seats_available)
      : undefined,
    waitlistCount: waitlistCounts.length ? Math.max(...waitlistCounts) : null,
  };
}

function toSection(
  catalog: TssScheduleInput,
  course: TssCourse,
  choice: BookingChoice,
): SnapshotSection {
  const enrollment = choiceEnrollment(choice);
  const instructors = [
    ...new Set(
      choice.components.flatMap((component) =>
        component.meetings.flatMap((meeting) =>
          meeting.instructor ? [meeting.instructor] : [],
        ),
      ),
    ),
  ];
  return {
    section_id: sectionId(catalog.term, course, choice),
    course_id: courseIdentity(course).courseId,
    section_code: sectionCode(choice),
    meeting_type: sectionMeetingType(choice),
    source_package_id: choice.package_id,
    source_package_display_id: choice.package_display_id,
    source_status: choice.status_text,
    source_disabled: choice.disabled,
    instructors,
    meetings: choice.components.flatMap((component) =>
      normalizeTssMeetingDays(catalog.term, component.meetings).map((meeting) =>
        toMeeting(component, meeting),
      ),
    ),
    enrolled: enrollment.enrolled,
    capacity: enrollment.capacity,
    available_seats: enrollment.availableSeats,
    capacity_kind: enrollment.capacityKind,
    reported_capacity: enrollment.reportedCapacity,
    reported_seats_available: enrollment.reportedSeatsAvailable,
    waitlist_count: enrollment.waitlistCount,
    availability_verified: Boolean(catalog.source_updated_at),
    availability_timestamp: catalog.source_updated_at,
    raw: {
      source: 'ucsd_tss',
      tss_course_code: course.tss_course_code,
      tss_module_id: course.module_id,
      tss_package_id: choice.package_id,
      tss_event_ids: choice.components.map((component) => component.event_id),
    },
  };
}

function toCourse(
  catalog: TssScheduleInput,
  course: TssCourse,
): SnapshotCourse {
  const { subject, courseNumber, courseId } = courseIdentity(course);
  const courseCode =
    catalog.term === 'FA26'
      ? sourceIdentifier(course.tss_course_code)
      : `${subject} ${courseNumber}`;
  return {
    course_id: courseId,
    subject,
    course_number: courseNumber,
    display_course_code: catalog.term === 'FA26' ? courseCode : undefined,
    title: course.course_title ?? courseCode,
    units: course.units,
    delivery_mode: course.delivery_mode,
    department_notes: course.department_notes,
    course_notes: course.course_notes,
    enrollment_requirements: course.enrollment_requirements,
    description: course.description,
    prerequisites_text: null,
    restrictions_text: null,
    catalog_url: null,
    archive_avg_gpa: null,
    archive_record_count: 0,
    grade_archive_records: [],
    ge_matches: [],
    sections: course.booking_choices.map((choice) =>
      toSection(catalog, course, choice),
    ),
  };
}

function parseTssResponse(
  value: unknown,
  generatedAt: string,
): ParsedScheduleOfClasses[] {
  const catalog = parseTssScheduleArtifact(value);
  const coursesBySubject = Map.groupBy(
    catalog.courses,
    (course) => courseIdentity(course).subject,
  );
  return [...coursesBySubject].map(([subject, courses]) => ({
    subject,
    term: catalog.term,
    source_url:
      catalog.input_schema_version === 'tss-chatbot-v1'
        ? 'tss-chatbot-v1'
        : 'ucsd-tss-schedule',
    fetched_at: generatedAt,
    source_timestamp: catalog.source_updated_at,
    courses: courses.map((course) => toCourse(catalog, course)),
  }));
}

function snapshotCoverage(responses: unknown[], configuredSubjects: string[]) {
  const parsed = responses.map((response) =>
    parseTssScheduleArtifact(response),
  );
  const coveredSubjects = new Set(
    parsed.flatMap((response) => {
      const isComplete =
        response.coverage.complete &&
        !response.coverage.continuation_needed &&
        (response.coverage.omitted_courses?.length ?? 0) === 0;
      if (!isComplete) return [];
      return [
        ...response.courses.map((course) => courseIdentity(course).subject),
        ...response.requested_subjects,
      ];
    }),
  );
  const missingConfiguredSubject = configuredSubjects.some(
    (subject) => !coveredSubjects.has(subject),
  );
  return {
    complete: !missingConfiguredSubject,
    continuation_needed: missingConfiguredSubject,
  };
}

function sharedSourceTimestamp(
  parsedSubjects: ParsedScheduleOfClasses[],
): string | null {
  const timestamps = new Set(
    parsedSubjects.map((parsed) => parsed.source_timestamp),
  );
  if (timestamps.size !== 1) return null;
  return timestamps.values().next().value ?? null;
}

/**
 * Converts raw TSS schedule responses into the same self-contained Published
 * Snapshot contract used by every term. Catalog and grade data are joined by
 * canonical Course ID before the artifact reaches the frontend.
 */
export function buildTssCatalogSnapshot(
  config: CatalogSnapshotConfig,
  responses: unknown[],
  sources: TssCatalogSnapshotSources,
): CatalogSnapshot {
  const generatedAt = sources.generatedAt ?? new Date().toISOString();
  const sourceNeutralCourseFields = new Map(
    responses.flatMap((response) => {
      const artifact = parseTssScheduleArtifact(response);
      if (artifact.input_schema_version !== TSS_SCHEDULE_SCHEMA_VERSION)
        return [];
      return artifact.courses.map((course) => {
        const identity = courseIdentity(course);
        return [
          identity.courseId,
          {
            title: course.course_title,
            units: course.units,
            description: course.description,
            delivery_mode: course.delivery_mode,
            department_notes: course.department_notes,
            course_notes: course.course_notes,
            enrollment_requirements: course.enrollment_requirements,
          },
        ] as const;
      });
    }),
  );
  const parsedSubjects = responses.flatMap((response) =>
    parseTssResponse(response, generatedAt),
  );
  for (const parsed of parsedSubjects) {
    if (parsed.term !== config.active_planning_term) {
      throw new Error(
        `TSS term ${parsed.term} does not match ${config.active_planning_term}`,
      );
    }
  }

  const scheduleSnapshot = buildScheduleCatalogSnapshot(
    config,
    parsedSubjects,
    { runId: sources.runId, generatedAt },
  );
  const enriched = attachGradeArchiveRecords(
    attachGeneralCatalogMetadata(
      scheduleSnapshot,
      sources.generalCatalog.courses,
    ),
    sources.gradeArchive.records,
  );
  return {
    ...enriched,
    courses: enriched.courses.map((course) => {
      const sourceFields = sourceNeutralCourseFields.get(course.course_id);
      if (!sourceFields) return course;
      return {
        ...course,
        title: sourceFields.title ?? course.title,
        units: sourceFields.units ?? course.units,
        description: sourceFields.description ?? course.description,
        delivery_mode: sourceFields.delivery_mode,
        department_notes: sourceFields.department_notes,
        course_notes: sourceFields.course_notes,
        enrollment_requirements: sourceFields.enrollment_requirements,
      };
    }),
    coverage: snapshotCoverage(responses, config.configured_subjects),
    source_timestamps: {
      schedule_of_classes: sharedSourceTimestamp(parsedSubjects),
      general_catalog: sources.generalCatalog.sourceTimestamp,
      instructor_grade_archive: sources.gradeArchive.sourceTimestamp,
    },
  };
}
