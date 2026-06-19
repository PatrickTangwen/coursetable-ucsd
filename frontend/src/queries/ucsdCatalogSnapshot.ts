import z from 'zod';

import type { Crn, Season } from './graphql-types';
import type { CatalogBySeasonQuery } from '../generated/graphql-types';

type CoursePublic = CatalogBySeasonQuery['courses'][number];
type CourseMap = Map<number, CoursePublic>;

type CourseMeetingWithLocation = CoursePublic['course_meetings'][number] & {
  location?: {
    room: string | null;
    building: {
      code: string;
    };
  } | null;
};

const sourceTimestampsSchema = z.object({
  schedule_of_classes: z.string().nullable(),
  general_catalog: z.string().nullable(),
  instructor_grade_archive: z.string().nullable(),
});

const ucsdMeetingSchema = z.object({
  days: z.array(z.string()),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  building: z.string().nullable(),
  room: z.string().nullable(),
  is_tba: z.boolean(),
  raw_days: z.string().nullable(),
  raw_time: z.string().nullable(),
  raw_location: z.string().nullable(),
});

const ucsdSectionSchema = z.object({
  section_id: z.string(),
  course_id: z.string(),
  section_code: z.string().nullable(),
  meeting_type: z.string().nullable(),
  instructors: z.array(z.string()),
  meetings: z.array(ucsdMeetingSchema),
  raw: z.record(z.unknown()),
});

const ucsdCourseSchema = z.object({
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
  grade_archive_records: z.array(z.unknown()),
  ge_matches: z.array(z.unknown()),
  sections: z.array(ucsdSectionSchema),
});

const ucsdCatalogSnapshotSchema = z.object({
  run_id: z.string(),
  generated_at: z.string(),
  active_planning_term: z.string(),
  term_label: z.string(),
  term_date_range: z.object({
    start: z.string(),
    end: z.string(),
  }),
  configured_subjects: z.array(z.string()),
  source_timestamps: sourceTimestampsSchema,
  courses: z.array(ucsdCourseSchema),
});

type UcsdCatalogSnapshot = z.infer<typeof ucsdCatalogSnapshotSchema>;
type UcsdCourse = UcsdCatalogSnapshot['courses'][number];
type UcsdSection = UcsdCourse['sections'][number];

const dayValues: { [day: string]: number } = {
  Su: 0,
  Sun: 0,
  Sunday: 0,
  M: 1,
  Mo: 1,
  Mon: 1,
  Monday: 1,
  Tu: 2,
  Tue: 2,
  Tuesday: 2,
  W: 3,
  We: 3,
  Wed: 3,
  Wednesday: 3,
  Th: 4,
  Thu: 4,
  Thursday: 4,
  F: 5,
  Fri: 5,
  Friday: 5,
  Sa: 6,
  Sat: 6,
  Saturday: 6,
};

function stableCompatNumber(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function parseUnits(units: string | null): number | null {
  if (!units) return null;
  const match = /\d+(?:\.\d+)?/u.exec(units);
  return match ? Number(match[0]) : null;
}

function toDaysOfWeek(days: string[]): number {
  return days.reduce((mask, day) => {
    const dayValue = dayValues[day];
    return dayValue === undefined ? mask : mask | (1 << dayValue);
  }, 0);
}

function toRequirements(course: UcsdCourse): string | null {
  const parts = [course.prerequisites_text, course.restrictions_text].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join('\n') : null;
}

function toCourseMeetings(section: UcsdSection): CourseMeetingWithLocation[] {
  return section.meetings.flatMap((meeting) => {
    if (meeting.is_tba || !meeting.start_time || !meeting.end_time) return [];
    const location =
      meeting.building || meeting.room
        ? {
            room: meeting.room,
            building: {
              code: meeting.building ?? 'TBA',
            },
          }
        : null;
    return [
      {
        days_of_week: toDaysOfWeek(meeting.days),
        start_time: meeting.start_time,
        end_time: meeting.end_time,
        location,
      },
    ];
  });
}

function toCoursePublic(
  snapshot: UcsdCatalogSnapshot,
  course: UcsdCourse,
  section: UcsdSection,
): CoursePublic {
  const crn = stableCompatNumber(section.section_id) as Crn;
  const sameCourseId = stableCompatNumber(course.course_id);
  const courseCode = `${course.subject} ${course.course_number}`;
  const courseMeetings = toCourseMeetings(section);
  const instructors = section.instructors.map((name) => ({
    professor: {
      professor_id: stableCompatNumber(name),
      name,
    },
  }));
  const listing = {
    course_code: courseCode,
    crn,
    number: course.course_number,
    school: 'UCSD',
    section_id: section.section_id,
    subject: course.subject,
  };

  return {
    areas: [],
    colsem: false,
    course_id: stableCompatNumber(section.section_id),
    credits: parseUnits(course.units),
    description: course.description,
    extra_info: 'ACTIVE',
    final_exam: null,
    fysem: false,
    last_offered_course_id: null,
    primary_crn: crn,
    requirements: toRequirements(course),
    same_course_and_profs_id: stableCompatNumber(
      `${course.course_id}:${section.instructors.join('|')}`,
    ),
    same_course_id: sameCourseId,
    season_code: snapshot.active_planning_term as Season,
    section: section.section_code ?? '',
    skills: [],
    sysem: false,
    title: course.title,
    time_added: snapshot.generated_at,
    last_updated:
      snapshot.source_timestamps.schedule_of_classes ?? snapshot.generated_at,
    course_flags: [],
    course_professors: instructors,
    listings: [listing],
    course_meetings: courseMeetings,
  };
}

export function adaptUcsdCatalogSnapshot(
  snapshot: UcsdCatalogSnapshot,
): CourseMap {
  const adapted = new Map<number, CoursePublic>();
  for (const course of snapshot.courses) {
    for (const section of course.sections) {
      const coursePublic = toCoursePublic(snapshot, course, section);
      adapted.set(coursePublic.course_id, coursePublic);
    }
  }
  return adapted;
}

export function catalogResponseToCourseMap(response: unknown): CourseMap {
  const parsedSnapshot = ucsdCatalogSnapshotSchema.safeParse(response);
  if (parsedSnapshot.success)
    return adaptUcsdCatalogSnapshot(parsedSnapshot.data);

  const data = response as CatalogBySeasonQuery['courses'];
  const info = new Map<number, CoursePublic>();
  for (const course of data) info.set(course.course_id, course);
  return info;
}
