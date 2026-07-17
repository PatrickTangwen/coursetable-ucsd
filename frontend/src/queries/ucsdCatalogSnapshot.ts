import z from 'zod';

import {
  coursePlanningPastGradeSchema,
  normalizePublishedSnapshot,
  type CoursePlanningCatalog,
  type CoursePlanningCourse,
  type CoursePlanningMeeting,
  type CoursePlanningSection,
} from './coursePlanningViewModels';
import type { Crn, Season } from './graphql-types';
import type { CatalogBySeasonQuery } from '../generated/graphql-types';

type CoursePublic = CatalogBySeasonQuery['courses'][number];
type CourseMap = Map<number, CoursePublic>;

type CourseMeetingWithLocation = CoursePublic['course_meetings'][number] & {
  date?: string | null;
  location?: {
    room: string | null;
    building: {
      code: string;
    };
  } | null;
  meeting_type?: string | null;
  raw_location?: string | null;
};

type LegacyUcsdMeeting = {
  days: string[];
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  is_tba: boolean;
  meeting_type: string | null;
  raw_days: string | null;
  raw_time: string | null;
  raw_location: string | null;
};

export type UcsdCalendarDetails = {
  term_date_range: CoursePlanningCatalog['termDateRange'];
  section_id: string;
  section_code: string | null;
  meeting_type: string | null;
  meetings: LegacyUcsdMeeting[];
  enrolled: number | null;
  capacity: number | null;
  waitlist_count: number;
  source_note: string | null;
};

const ucsdCourseArchiveSchema = z.object({
  archive_record_count: z.number(),
  source_timestamp: z.string().nullable(),
  catalog_source_timestamp: z.string().nullable(),
  catalog_url: z.string().nullable(),
  units: z.string().nullable(),
  prerequisites_text: z.string().nullable(),
  restrictions_text: z.string().nullable(),
  grade_archive_records: z.array(coursePlanningPastGradeSchema),
});

export type UcsdCourseArchive = z.infer<typeof ucsdCourseArchiveSchema>;

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

function parseLegacyCredits(units: string | null): number | null {
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

function toLegacyMeeting(meeting: CoursePlanningMeeting): LegacyUcsdMeeting {
  return {
    days: meeting.days,
    date: meeting.date,
    start_time: meeting.startTime,
    end_time: meeting.endTime,
    building: meeting.building,
    room: meeting.room,
    is_tba: meeting.isTba,
    meeting_type: meeting.meetingType,
    raw_days: meeting.rawDays,
    raw_time: meeting.rawTime,
    raw_location: meeting.rawLocation,
  };
}

function toCourseMeetings(
  section: CoursePlanningSection,
): CourseMeetingWithLocation[] {
  return section.meetings.flatMap((meeting) => {
    if (meeting.isTba || !meeting.startTime || !meeting.endTime) return [];
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
        date: meeting.date,
        days_of_week: toDaysOfWeek(meeting.days),
        start_time: meeting.startTime,
        end_time: meeting.endTime,
        location,
        meeting_type:
          meeting.meetingType ??
          (section.meetings.length === 1 ? section.meetingType : null),
        raw_location: meeting.rawLocation,
      },
    ];
  });
}

function toCoursePublic(
  catalog: CoursePlanningCatalog,
  course: CoursePlanningCourse,
  section: CoursePlanningSection,
): CoursePublic {
  const crn = stableCompatNumber(section.sectionId) as Crn;
  const sameCourseId = stableCompatNumber(course.courseId);
  const courseMeetings = toCourseMeetings(section);
  const instructors = section.instructors.map(({ name }) => ({
    professor: {
      professor_id: stableCompatNumber(name),
      name,
    },
  }));
  const listing = {
    course_code: course.courseCode,
    crn,
    number: course.courseNumber,
    school: 'UCSD',
    section_id: section.sectionId,
    subject: course.subject,
  };
  const ucsdArchive: UcsdCourseArchive = {
    archive_record_count: course.archiveRecordCount,
    source_timestamp: catalog.sourceTimestamps.instructorGradeArchive,
    catalog_source_timestamp: catalog.sourceTimestamps.generalCatalog,
    catalog_url: course.catalogUrl,
    units: course.units,
    prerequisites_text: course.prerequisites,
    restrictions_text: course.restrictions,
    grade_archive_records: course.pastGrades,
  };
  const ucsdCalendar: UcsdCalendarDetails = {
    term_date_range: catalog.termDateRange,
    section_id: section.sectionId,
    section_code: section.sectionCode,
    meeting_type: section.meetingType,
    meetings: section.meetings.map(toLegacyMeeting),
    enrolled: section.availability.enrolled,
    capacity: section.availability.capacity,
    waitlist_count: section.availability.waitlistCount,
    source_note: section.sourceNote,
  };

  const coursePublic: CoursePublic & {
    ucsd_archive: UcsdCourseArchive;
    ucsd_calendar: UcsdCalendarDetails;
  } = {
    areas: [],
    colsem: false,
    course_id: stableCompatNumber(section.sectionId),
    credits: parseLegacyCredits(course.units),
    description: course.description,
    extra_info: 'ACTIVE',
    final_exam: null,
    fysem: false,
    last_offered_course_id: null,
    primary_crn: crn,
    requirements: course.requirements,
    same_course_and_profs_id: stableCompatNumber(
      `${course.courseId}:${section.instructors.map(({ name }) => name).join('|')}`,
    ),
    same_course_id: sameCourseId,
    season_code: catalog.supportedTerm as Season,
    section: section.sectionCode ?? '',
    skills: [],
    sysem: false,
    title: course.title,
    time_added: catalog.generatedAt,
    last_updated:
      catalog.sourceTimestamps.scheduleOfClasses ?? catalog.generatedAt,
    course_flags: [],
    course_professors: instructors,
    listings: [listing],
    course_meetings: courseMeetings,
    ucsd_archive: ucsdArchive,
    ucsd_calendar: ucsdCalendar,
  };
  return coursePublic;
}

/**
 * Temporary expand-contract boundary for active consumers that still expect
 * the inherited catalog map. New UCSD code should consume
 * CoursePlanningCatalog.
 */
export function adaptCoursePlanningCatalog(
  catalog: CoursePlanningCatalog,
): CourseMap {
  const adapted = new Map<number, CoursePublic>();
  for (const course of catalog.courses) {
    for (const section of course.sections) {
      const coursePublic = toCoursePublic(catalog, course, section);
      adapted.set(coursePublic.course_id, coursePublic);
    }
  }
  return adapted;
}

export function catalogResponseToCourseMap(response: unknown): CourseMap {
  const catalog = normalizePublishedSnapshot(response);
  if (catalog) return adaptCoursePlanningCatalog(catalog);

  const data = response as CatalogBySeasonQuery['courses'];
  const info = new Map<number, CoursePublic>();
  for (const course of data) info.set(course.course_id, course);
  return info;
}

export function getUcsdArchiveDetails(
  course: unknown,
): UcsdCourseArchive | null {
  const parsed = z
    .object({
      ucsd_archive: ucsdCourseArchiveSchema,
    })
    .passthrough()
    .safeParse(course);
  return parsed.success ? parsed.data.ucsd_archive : null;
}
