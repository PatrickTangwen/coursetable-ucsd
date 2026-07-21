import z from 'zod';

export type CoursePlanningTermDateRange = {
  start: string;
  end: string;
};

export type CoursePlanningSourceTimestamps = {
  scheduleOfClasses: string | null;
  generalCatalog: string | null;
  instructorGradeArchive: string | null;
};

export const coursePlanningPastGradeSchema = z.object({
  subject: z.string(),
  course: z.string(),
  year: z.string(),
  quarter: z.string(),
  title: z.string().nullable(),
  instructor: z.string().nullable(),
  gpa: z.number().nullable(),
  a: z.number().nullable(),
  b: z.number().nullable(),
  c: z.number().nullable(),
  d: z.number().nullable(),
  f: z.number().nullable(),
  w: z.number().nullable(),
  p: z.number().nullable(),
  np: z.number().nullable(),
  raw: z.record(z.string()),
});

export type CoursePlanningPastGrade = z.infer<
  typeof coursePlanningPastGradeSchema
>;

export type CoursePlanningMeeting = {
  days: string[];
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  building: string | null;
  room: string | null;
  isTba: boolean;
  meetingType: string | null;
  rawDays: string | null;
  rawTime: string | null;
  rawLocation: string | null;
};

export type CoursePlanningInstructor = {
  name: string;
};

export type CoursePlanningAvailability = {
  enrolled: number | null;
  capacity: number | null;
  availableSeats: number | null;
  waitlistCount: number | null;
  snapshotTimestamp: string | null;
};

export type CoursePlanningCoverage = {
  complete: boolean;
  continuationNeeded: boolean;
};

export type CoursePlanningSection = {
  sectionId: string;
  courseId: string;
  supportedTerm: string;
  sectionCode: string | null;
  meetingType: string | null;
  instructors: CoursePlanningInstructor[];
  meetings: CoursePlanningMeeting[];
  availability: CoursePlanningAvailability;
  sourceNote: string | null;
};

export type CoursePlanningCourse = {
  courseId: string;
  subject: string;
  courseNumber: string;
  courseCode: string;
  title: string;
  units: string | null;
  description: string | null;
  prerequisites: string | null;
  restrictions: string | null;
  requirements: string | null;
  catalogUrl: string | null;
  archiveRecordCount: number;
  pastGrades: CoursePlanningPastGrade[];
  sections: CoursePlanningSection[];
};

export type CoursePlanningCatalog = {
  supportedTerm: string;
  termLabel: string;
  generatedAt: string;
  termDateRange: CoursePlanningTermDateRange | null;
  sourceTimestamps: CoursePlanningSourceTimestamps;
  coverage: CoursePlanningCoverage;
  courses: CoursePlanningCourse[];
};

export type CoursePlanningListing = {
  course: CoursePlanningCourse;
  section: CoursePlanningSection;
  generatedAt: string;
  termDateRange?: CoursePlanningTermDateRange | null;
  catalogCoverage: CoursePlanningCoverage;
  evaluation: CoursePlanningEvaluation;
};

export type CoursePlanningEvaluation = {
  overallRating: number | null;
  workload: number | null;
  professorRating: number | null;
  gutRating: number | null;
  enrollment: number | null;
};

/**
 * Preserves the generated numeric identity used by existing Course modal links
 * while the owned model keeps Section ID as its canonical identity.
 */
export function coursePlanningSectionModalId(sectionId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < sectionId.length; i += 1) {
    hash ^= sectionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function flattenCoursePlanningCatalog(
  catalog: CoursePlanningCatalog,
): CoursePlanningListing[] {
  return catalog.courses.flatMap((course) =>
    course.sections.map((section) => ({
      course,
      section,
      generatedAt: catalog.generatedAt,
      termDateRange: catalog.termDateRange,
      catalogCoverage: catalog.coverage,
      evaluation: {
        overallRating: null,
        workload: null,
        professorRating: null,
        gutRating: null,
        enrollment: null,
      },
    })),
  );
}

type CoursePlanningSectionDraft = Omit<
  CoursePlanningSection,
  'supportedTerm' | 'availability'
> & {
  availability: Omit<CoursePlanningAvailability, 'snapshotTimestamp'>;
};

type CoursePlanningCourseDraft = Omit<CoursePlanningCourse, 'sections'> & {
  sections: CoursePlanningSectionDraft[];
};

function meetingIdentity(meeting: CoursePlanningMeeting): string {
  return [
    meeting.meetingType ?? '',
    meeting.date ?? '',
    meeting.rawDays ?? meeting.days.join(','),
    meeting.startTime ?? '',
    meeting.endTime ?? '',
    meeting.rawLocation ?? '',
    meeting.building ?? '',
    meeting.room ?? '',
    meeting.isTba ? '1' : '0',
  ].join('|');
}

function dedupeMeetings(
  meetings: CoursePlanningMeeting[],
): CoursePlanningMeeting[] {
  const seen = new Set<string>();
  return meetings.filter((meeting) => {
    const identity = meetingIdentity(meeting);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function sourceNote(raw: { [key: string]: unknown }): string | null {
  const { source } = raw;
  if (typeof source !== 'string' || !source) return null;
  return source === 'ucsd_schedule_of_classes'
    ? 'UCSD Schedule of Classes'
    : source;
}

const meetingSchema = z
  .object({
    days: z.array(z.string()),
    date: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    start_time: z.string().nullable(),
    end_time: z.string().nullable(),
    building: z.string().nullable(),
    room: z.string().nullable(),
    is_tba: z.boolean(),
    meeting_type: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    raw_days: z.string().nullable(),
    raw_time: z.string().nullable(),
    raw_location: z.string().nullable(),
  })
  .transform(
    (meeting): CoursePlanningMeeting => ({
      days: meeting.days,
      date: meeting.date,
      startTime: meeting.start_time,
      endTime: meeting.end_time,
      building: meeting.building,
      room: meeting.room,
      isTba: meeting.is_tba,
      meetingType: meeting.meeting_type,
      rawDays: meeting.raw_days,
      rawTime: meeting.raw_time,
      rawLocation: meeting.raw_location,
    }),
  );

const sectionSchema = z
  .object({
    section_id: z.string(),
    course_id: z.string(),
    section_code: z.string().nullable(),
    meeting_type: z.string().nullable(),
    instructors: z.array(z.string()),
    meetings: z.array(meetingSchema),
    enrolled: z
      .number()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    capacity: z
      .number()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    waitlist_count: z
      .number()
      .nullable()
      .optional()
      .transform((value) => value ?? 0),
    raw: z.record(z.unknown()),
  })
  .transform(
    (section): CoursePlanningSectionDraft => ({
      sectionId: section.section_id,
      courseId: section.course_id,
      sectionCode: section.section_code,
      meetingType: section.meeting_type,
      instructors: section.instructors.map((name) => ({ name })),
      meetings: dedupeMeetings(section.meetings),
      availability: {
        enrolled: section.enrolled,
        capacity: section.capacity,
        availableSeats:
          section.enrolled === null || section.capacity === null
            ? null
            : Math.max(section.capacity - section.enrolled, 0),
        waitlistCount: section.waitlist_count,
      },
      sourceNote: sourceNote(section.raw),
    }),
  );

const courseSchema = z
  .object({
    course_id: z.string(),
    subject: z.string(),
    course_number: z.string(),
    title: z.string(),
    units: z.string().nullable(),
    description: z.string().nullable(),
    prerequisites_text: z.string().nullable(),
    restrictions_text: z.string().nullable(),
    catalog_url: z.string().nullable(),
    archive_avg_gpa: z.number().nullable(),
    archive_record_count: z.number(),
    grade_archive_records: z.array(coursePlanningPastGradeSchema),
    ge_matches: z.array(z.unknown()),
    sections: z.array(sectionSchema),
  })
  .transform((course): CoursePlanningCourseDraft => {
    const requirementParts = [
      course.prerequisites_text,
      course.restrictions_text,
    ].filter((value): value is string => Boolean(value));
    return {
      courseId: course.course_id,
      subject: course.subject,
      courseNumber: course.course_number,
      courseCode: `${course.subject} ${course.course_number}`,
      title: course.title,
      units: course.units,
      description: course.description,
      prerequisites: course.prerequisites_text,
      restrictions: course.restrictions_text,
      requirements:
        requirementParts.length > 0 ? requirementParts.join('\n') : null,
      catalogUrl: course.catalog_url,
      archiveRecordCount: course.archive_record_count,
      pastGrades: course.grade_archive_records,
      sections: course.sections,
    };
  });

const sourceTimestampsSchema = z.object({
  schedule_of_classes: z.string().nullable(),
  general_catalog: z.string().nullable(),
  instructor_grade_archive: z.string().nullable(),
});

export const publishedSnapshotSchema = z
  .object({
    run_id: z.string(),
    generated_at: z.string(),
    active_planning_term: z.string(),
    term_label: z.string(),
    term_date_range: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .nullable(),
    configured_subjects: z.array(z.string()),
    source_timestamps: sourceTimestampsSchema,
    courses: z.array(courseSchema),
  })
  .transform(
    (snapshot): CoursePlanningCatalog => ({
      supportedTerm: snapshot.active_planning_term,
      termLabel: snapshot.term_label,
      generatedAt: snapshot.generated_at,
      termDateRange: snapshot.term_date_range,
      sourceTimestamps: {
        scheduleOfClasses: snapshot.source_timestamps.schedule_of_classes,
        generalCatalog: snapshot.source_timestamps.general_catalog,
        instructorGradeArchive:
          snapshot.source_timestamps.instructor_grade_archive,
      },
      coverage: {
        complete: true,
        continuationNeeded: false,
      },
      courses: snapshot.courses.map((course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          supportedTerm: snapshot.active_planning_term,
          availability: {
            ...section.availability,
            snapshotTimestamp: snapshot.source_timestamps.schedule_of_classes,
          },
        })),
      })),
    }),
  );

export function normalizePublishedSnapshot(
  response: unknown,
): CoursePlanningCatalog | null {
  const parsed = publishedSnapshotSchema.safeParse(response);
  return parsed.success ? parsed.data : null;
}
