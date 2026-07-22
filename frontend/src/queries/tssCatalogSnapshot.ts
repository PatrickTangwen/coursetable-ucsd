import z from 'zod';

import type {
  CoursePlanningCatalog,
  CoursePlanningCourse,
  CoursePlanningMeeting,
  CoursePlanningSection,
} from './coursePlanningViewModels';
import {
  normalizeTssMeetingDays,
  normalizeTssMeetingLocation,
} from '../../../shared/tssMeetingDays.js';

const tssMeetingSchema = z.object({
  meeting_kind: z.string(),
  specific_date: z.string().nullable(),
  days: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  location_displayed: z.string().nullable(),
  instructor: z.string().nullable(),
  is_remote: z.boolean().optional().default(false),
  is_tba: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform((value) => Boolean(value)),
  is_arranged: z.boolean().nullable(),
});

const tssEnrollmentSchema = z.object({
  enrolled: z.number().nullable(),
  capacity: z.number().nullable(),
  seats_available: z.number().nullable(),
  capacity_kind: z.enum(['bounded', 'effectively_unbounded']).optional(),
  reported_capacity: z.number().nullable().optional(),
  reported_seats_available: z.number().nullable().optional(),
  waitlist: z.object({
    state: z.string(),
    count: z.number().nullable(),
    capacity: z.number().nullable().optional(),
    available_spots: z.number().nullable().optional(),
  }),
});

const tssComponentSchema = z.object({
  type: z.string(),
  section_code: z.string(),
  event_id: z.string(),
  requirement: z.string(),
  instructors_text: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  is_cancelled: z.boolean().optional().default(false),
  meetings: z.array(tssMeetingSchema),
  enrollment: tssEnrollmentSchema,
});

const tssBookingChoiceSchema = z.object({
  booking_choice_ordinal: z.number().int().positive(),
  displayed_package_section: z.string().nullable(),
  displayed_package_id: z.string().nullable(),
  components: z.array(tssComponentSchema).min(1),
});

const tssCatalogSchema = z.object({
  schema_version: z.literal('tss-chatbot-v1'),
  term: z.string().min(1),
  requested_course: z.string().min(1).optional(),
  source_metadata: z.object({
    last_refreshed_displayed: z.string().nullable(),
  }),
  coverage: z.object({
    complete: z.boolean(),
    continuation_needed: z.boolean(),
    omitted_courses: z.array(z.string().min(1)).optional(),
  }),
  courses: z.array(
    z.object({
      course_code: z.string().min(1),
      course_title: z.string().min(1).nullable(),
      tss_course_code: z.string().min(1),
      booking_choices: z.array(tssBookingChoiceSchema),
    }),
  ),
});

type TssCatalog = z.infer<typeof tssCatalogSchema>;
type TssCourse = TssCatalog['courses'][number];
type TssBookingChoice = TssCourse['booking_choices'][number];

const termLabels: { [term: string]: string } = {
  FA: 'Fall',
  S1: 'Summer Session 1',
  S2: 'Summer Session 2',
  S3: 'Summer Session 3',
  SP: 'Spring',
  SU: 'Summer',
  WI: 'Winter',
};

function termLabel(term: string): string {
  const match = /^(?<quarter>WI|SP|S1|S2|S3|SU|FA)(?<year>\d{2})$/u.exec(term);
  const quarter = match?.groups?.quarter;
  const year = match?.groups?.year;
  return quarter && year ? `${termLabels[quarter] ?? quarter} 20${year}` : term;
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

function sourceIdentifier(value: string): string {
  return value.trim().replace(/\s+/gu, '');
}

function sectionId(
  term: string,
  course: TssCourse,
  choice: TssBookingChoice,
): string {
  if (choice.displayed_package_id)
    return `${term}:${sourceIdentifier(choice.displayed_package_id)}`;
  const componentIds = choice.components.map((component) =>
    sourceIdentifier(component.event_id),
  );
  return `${term}:${sourceIdentifier(course.tss_course_code)}:${componentIds.join('+')}`;
}

function sectionCode(choice: TssBookingChoice): string {
  return (
    choice.displayed_package_section ??
    choice.components.map((component) => component.section_code).join(' + ')
  );
}

function sectionMeetingType(choice: TssBookingChoice): string {
  const types = new Set(choice.components.map((component) => component.type));
  if (types.size !== 1) return 'Package';
  const [type = 'Meeting'] = types;
  return type.length <= 3 ? type.toUpperCase() : type;
}

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
  studio: 'Studio',
  tu: 'Tutorial',
};

const tssDayNames: { [day: string]: string } = {
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

function dayTokens(value: string | null): string[] {
  return (value ?? '')
    .trim()
    .split(/\s+/u)
    .filter((day) => Boolean(tssDayNames[day]));
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

function toMeeting(
  component: TssBookingChoice['components'][number],
  meeting: TssBookingChoice['components'][number]['meetings'][number],
): CoursePlanningMeeting {
  const tokens = dayTokens(meeting.days);
  const startTime = time24(meeting.start_time);
  const endTime = time24(meeting.end_time);
  const { building, room, rawLocation } = normalizeTssMeetingLocation(meeting);
  const isTba =
    meeting.is_tba ||
    meeting.is_arranged === true ||
    !startTime ||
    !endTime ||
    (!meeting.specific_date && tokens.length === 0);
  const meetingType =
    meeting.meeting_kind === 'final'
      ? 'Final'
      : meeting.meeting_kind === 'midterm'
        ? 'Midterm'
        : (meetingTypeLabels[component.type.toLowerCase()] ?? component.type);
  return {
    days: tokens.map((day) => tssDayNames[day]!),
    date: meeting.specific_date,
    startTime,
    endTime,
    building,
    room,
    isTba,
    meetingType,
    rawDays: tokens.map((day) => rawDayNames[day]).join('') || null,
    rawTime:
      meeting.start_time && meeting.end_time
        ? `${meeting.start_time}-${meeting.end_time}`
        : null,
    rawLocation,
  };
}

function choiceAvailability(choice: TssBookingChoice) {
  const required = choice.components.filter(
    (component) => component.requirement === 'required',
  );
  const components = required.length > 0 ? required : choice.components;
  const isUnbounded = (component: (typeof components)[number]) =>
    component.enrollment.capacity_kind === 'effectively_unbounded' ||
    component.enrollment.capacity === 9999 ||
    component.enrollment.capacity === 99999 ||
    component.enrollment.seats_available === 9999 ||
    component.enrollment.seats_available === 99999;
  const allSeatsKnown = components.every(
    (component) =>
      isUnbounded(component) || component.enrollment.seats_available !== null,
  );
  const boundedComponents = components.filter(
    (component) => !isUnbounded(component),
  );
  const limitingComponent = (allSeatsKnown ? boundedComponents : []).reduce<
    (typeof components)[number] | null
  >((current, component) => {
    if (!current) return component;
    return component.enrollment.seats_available! <
      current.enrollment.seats_available!
      ? component
      : current;
  }, null);
  const allUnbounded =
    allSeatsKnown && components.every((component) => isUnbounded(component));
  const unboundedEnrolled = allUnbounded
    ? components
        .map((component) => component.enrollment.enrolled)
        .filter(
          (value): value is number =>
            value !== null && value !== 9999 && value !== 99999,
        )
    : [];
  const waitlistCounts = components
    .map((component) => component.enrollment.waitlist.count)
    .filter((count): count is number => count !== null);
  return {
    enrolled: allUnbounded
      ? unboundedEnrolled.length
        ? Math.max(...unboundedEnrolled)
        : null
      : (limitingComponent?.enrollment.enrolled ?? null),
    capacity: allUnbounded
      ? null
      : (limitingComponent?.enrollment.capacity ?? null),
    availableSeats: allUnbounded
      ? null
      : (limitingComponent?.enrollment.seats_available ?? null),
    capacityKind: allUnbounded
      ? ('effectively_unbounded' as const)
      : limitingComponent
        ? ('bounded' as const)
        : null,
    waitlistCount:
      waitlistCounts.length > 0 ? Math.max(...waitlistCounts) : null,
  };
}

function catalogCoverage(catalog: TssCatalog) {
  const complete =
    catalog.coverage.complete &&
    !catalog.coverage.continuation_needed &&
    (catalog.coverage.omitted_courses?.length ?? 0) === 0;
  return {
    complete,
    continuationNeeded: !complete,
  };
}

function sourceNote(catalog: TssCatalog): string {
  if (catalogCoverage(catalog).complete) return 'TSS schedule snapshot';
  return 'TSS schedule snapshot · partial coverage; continuation needed';
}

function toSection(
  catalog: TssCatalog,
  course: TssCourse,
  choice: TssBookingChoice,
): CoursePlanningSection {
  const { courseId } = courseIdentity(course);
  const availability = choiceAvailability(choice);
  const snapshotTimestamp = catalog.source_metadata.last_refreshed_displayed;
  const instructors = [
    ...new Set(
      choice.components.flatMap((component) => [
        ...(component.instructors_text ? [component.instructors_text] : []),
        ...component.meetings.flatMap((meeting) =>
          meeting.instructor ? [meeting.instructor] : [],
        ),
      ]),
    ),
  ];
  return {
    sectionId: sectionId(catalog.term, course, choice),
    courseId,
    supportedTerm: catalog.term,
    sectionCode: sectionCode(choice),
    meetingType: sectionMeetingType(choice),
    instructors: instructors.map((name) => ({ name })),
    meetings: choice.components.flatMap((component) =>
      normalizeTssMeetingDays(catalog.term, component.meetings).map((meeting) =>
        toMeeting(component, meeting),
      ),
    ),
    availability: {
      enrolled: snapshotTimestamp ? availability.enrolled : null,
      capacity: snapshotTimestamp ? availability.capacity : null,
      availableSeats: snapshotTimestamp ? availability.availableSeats : null,
      capacityKind: snapshotTimestamp ? availability.capacityKind : null,
      waitlistCount: snapshotTimestamp ? availability.waitlistCount : null,
      snapshotTimestamp,
    },
    sourceNote: sourceNote(catalog),
  };
}

function toCourse(
  catalog: TssCatalog,
  course: TssCourse,
): CoursePlanningCourse {
  const { subject, courseNumber, courseId } = courseIdentity(course);
  const courseCode =
    catalog.term === 'FA26'
      ? sourceIdentifier(course.tss_course_code)
      : `${subject} ${courseNumber}`;
  return {
    courseId,
    subject,
    courseNumber,
    courseCode,
    title: course.course_title ?? courseCode,
    units: null,
    description: null,
    prerequisites: null,
    restrictions: null,
    requirements: null,
    catalogUrl: null,
    archiveRecordCount: 0,
    pastGrades: [],
    sections: course.booking_choices.map((choice) =>
      toSection(catalog, course, choice),
    ),
  };
}

export function normalizeTssCatalogSnapshot(
  response: unknown,
): CoursePlanningCatalog | null {
  const parsed = tssCatalogSchema.safeParse(response);
  if (!parsed.success) return null;
  const catalog = parsed.data;
  return {
    supportedTerm: catalog.term,
    termLabel: termLabel(catalog.term),
    generatedAt: catalog.source_metadata.last_refreshed_displayed ?? '',
    termDateRange: null,
    sourceTimestamps: {
      scheduleOfClasses: catalog.source_metadata.last_refreshed_displayed,
      generalCatalog: null,
      instructorGradeArchive: null,
    },
    coverage: catalogCoverage(catalog),
    courses: catalog.courses.map((course) => toCourse(catalog, course)),
  };
}
