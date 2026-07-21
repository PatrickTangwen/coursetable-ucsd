import z from 'zod';

import type {
  CoursePlanningCatalog,
  CoursePlanningCourse,
  CoursePlanningMeeting,
  CoursePlanningSection,
} from './coursePlanningViewModels';

const tssMeetingSchema = z.object({
  meeting_kind: z.string(),
  specific_date: z.string().nullable(),
  days: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  location_displayed: z.string().nullable(),
  instructor: z.string().nullable(),
  is_tba: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform((value) => Boolean(value)),
  is_arranged: z.boolean().nullable(),
});

const tssEnrollmentSchema = z.object({
  enrolled: z.number().nullable(),
  capacity: z.number().nullable(),
  seats_available: z.number().nullable(),
  waitlist: z.object({
    state: z.string(),
    count: z.number().nullable(),
  }),
});

const tssComponentSchema = z.object({
  type: z.string(),
  section_code: z.string(),
  event_id: z.string(),
  requirement: z.string(),
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
  source_metadata: z.object({
    last_refreshed_displayed: z.string().nullable(),
  }),
  coverage: z.object({
    complete: z.boolean(),
    continuation_needed: z.boolean(),
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
  component: TssBookingChoice['components'][number],
  meeting: TssBookingChoice['components'][number]['meetings'][number],
): CoursePlanningMeeting {
  const tokens = dayTokens(meeting.days);
  const startTime = time24(meeting.start_time);
  const endTime = time24(meeting.end_time);
  const { building, room } = locationParts(meeting.location_displayed);
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
    rawLocation: meeting.location_displayed,
  };
}

function choiceAvailability(choice: TssBookingChoice) {
  const required = choice.components.filter(
    (component) => component.requirement === 'required',
  );
  const components = required.length > 0 ? required : choice.components;
  const availableSeats = components
    .map((component) => component.enrollment.seats_available)
    .filter((value): value is number => value !== null);
  const limitingSeats = availableSeats.length
    ? Math.min(...availableSeats)
    : null;
  const limitingComponent = components.find(
    (component) => component.enrollment.seats_available === limitingSeats,
  );
  const waitlistCounts = components
    .map((component) => component.enrollment.waitlist.count)
    .filter((count): count is number => count !== null);
  return {
    enrolled: limitingComponent?.enrollment.enrolled ?? null,
    capacity: limitingComponent?.enrollment.capacity ?? null,
    availableSeats: limitingSeats,
    waitlistCount:
      waitlistCounts.length > 0 ? Math.max(...waitlistCounts) : null,
  };
}

function sourceNote(catalog: TssCatalog): string {
  if (catalog.coverage.complete && !catalog.coverage.continuation_needed)
    return 'TSS schedule snapshot';
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
      choice.components.flatMap((component) =>
        component.meetings.flatMap((meeting) =>
          meeting.instructor ? [meeting.instructor] : [],
        ),
      ),
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
      component.meetings.map((meeting) => toMeeting(component, meeting)),
    ),
    availability: {
      enrolled: snapshotTimestamp ? availability.enrolled : null,
      capacity: snapshotTimestamp ? availability.capacity : null,
      availableSeats: snapshotTimestamp ? availability.availableSeats : null,
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
  return {
    courseId,
    subject,
    courseNumber,
    courseCode:
      catalog.term === 'FA26'
        ? sourceIdentifier(course.tss_course_code)
        : `${subject} ${courseNumber}`,
    title: course.course_title ?? `${subject} ${courseNumber}`,
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
    coverage: {
      complete: catalog.coverage.complete,
      continuationNeeded: catalog.coverage.continuation_needed,
    },
    courses: catalog.courses.map((course) => toCourse(catalog, course)),
  };
}
