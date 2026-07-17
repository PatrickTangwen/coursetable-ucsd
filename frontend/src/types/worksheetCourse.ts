import {
  coursePlanningSectionModalId,
  type CoursePlanningListing,
  type CoursePlanningMeeting,
} from '../queries/coursePlanningViewModels';
import type { Crn, Season } from '../queries/graphql-types';

export type WorksheetMeeting = {
  days_of_week: number;
  start_time: string | null;
  end_time: string | null;
  date?: string | null;
  meeting_type?: string | null;
  raw_location?: string | null;
  location?: {
    building: { code: string };
    room?: string | null;
  } | null;
};

export type WorksheetListingViewModel = {
  crn: Crn;
  course_code: string;
  number: string;
  subject: string;
  school: string;
  section_id: string;
  course: {
    season_code: Season;
    section: string;
    title: string;
    credits: number | null;
    last_updated?: string;
    same_course_id?: number;
    listings: {
      crn: Crn;
      course_code: string;
      section_id: string;
    }[];
    course_professors: { professor: { name: string } }[];
    course_meetings: WorksheetMeeting[];
    ucsd_calendar?: {
      term_date_range?: { start: string; end: string };
      section_id: string;
      section_code: string | null;
      meeting_type: string | null;
      meetings: {
        days: string[];
        start_time: string | null;
        end_time: string | null;
        building: string | null;
        room: string | null;
        is_tba: boolean;
        raw_days: string | null;
        raw_time: string | null;
        raw_location: string | null;
      }[];
      source_note: string | null;
    };
  };
};

export interface WorksheetCourse {
  crn: Crn;
  color: string;
  listing: WorksheetListingViewModel;
  hidden: boolean | null;
}

const weekdayBits: { [day: string]: number | undefined } = {
  Sunday: 1 << 0,
  Monday: 1 << 1,
  Tuesday: 1 << 2,
  Wednesday: 1 << 3,
  Thursday: 1 << 4,
  Friday: 1 << 5,
  Saturday: 1 << 6,
};

function meetingDays(meeting: CoursePlanningMeeting): number {
  return meeting.days.reduce((mask, day) => mask | (weekdayBits[day] ?? 0), 0);
}

function worksheetMeeting(meeting: CoursePlanningMeeting): WorksheetMeeting {
  return {
    days_of_week: meetingDays(meeting),
    start_time: meeting.startTime,
    end_time: meeting.endTime,
    date: meeting.date,
    meeting_type: meeting.meetingType,
    raw_location: meeting.rawLocation,
    location: meeting.building
      ? {
          building: { code: meeting.building },
          room: meeting.room,
        }
      : null,
  };
}

function courseCredits(units: string | null): number | null {
  if (!units) return null;
  const match = /\d+(?:\.\d+)?/u.exec(units);
  return match ? Number(match[0]) : null;
}

export function coursePlanningListingToWorksheetCourse(
  listing: CoursePlanningListing,
  color: string,
  hidden: boolean | null,
): WorksheetCourse {
  const crn = coursePlanningSectionModalId(listing.section.sectionId) as Crn;
  return {
    crn,
    color,
    hidden,
    listing: {
      crn,
      course_code: listing.course.courseCode,
      number: listing.course.courseNumber,
      subject: listing.course.subject,
      school: 'UCSD',
      section_id: listing.section.sectionId,
      course: {
        season_code: listing.section.supportedTerm as Season,
        section: listing.section.sectionCode ?? '',
        title: listing.course.title,
        credits: courseCredits(listing.course.units),
        last_updated: listing.generatedAt,
        same_course_id: crn,
        listings: listing.course.sections.map((section) => ({
          crn: coursePlanningSectionModalId(section.sectionId) as Crn,
          course_code: listing.course.courseCode,
          section_id: section.sectionId,
        })),
        course_professors: listing.section.instructors.map((instructor) => ({
          professor: { name: instructor.name },
        })),
        course_meetings: listing.section.meetings.flatMap((meeting) =>
          meeting.isTba || !meeting.startTime || !meeting.endTime
            ? []
            : [worksheetMeeting(meeting)],
        ),
        ucsd_calendar: {
          term_date_range: listing.termDateRange ?? undefined,
          section_id: listing.section.sectionId,
          section_code: listing.section.sectionCode,
          meeting_type: listing.section.meetingType,
          meetings: listing.section.meetings.map((meeting) => ({
            days: meeting.days,
            start_time: meeting.startTime,
            end_time: meeting.endTime,
            building: meeting.building,
            room: meeting.room,
            is_tba: meeting.isTba,
            raw_days: meeting.rawDays,
            raw_time: meeting.rawTime,
            raw_location: meeting.rawLocation,
          })),
          source_note: listing.section.sourceNote,
        },
      },
    },
  };
}
