import type { CatalogListing } from '../../queries/api';
import { formatTime } from '../../utilities/catalogView';
import { weekdays } from '../../utilities/constants';
import {
  ucsdMeetingTypeCode,
  ucsdMeetingTypeLabel,
} from '../CourseModal/ucsdMeetingTypes';

type ListItemMeeting = CatalogListing['course']['course_meetings'][number] & {
  date?: string | null;
  meeting_type?: string | null;
  raw_location?: string | null;
};

export const listDayLabels = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'] as const;

export type ListDayLabel = (typeof listDayLabels)[number];

export type ListDayFlags = { [day in ListDayLabel]: boolean };

const dayBit: { [day in ListDayLabel]: number } = {
  M: 1 << weekdays.Monday,
  Tu: 1 << weekdays.Tuesday,
  W: 1 << weekdays.Wednesday,
  Th: 1 << weekdays.Thursday,
  F: 1 << weekdays.Friday,
  Sa: 1 << weekdays.Saturday,
  Su: 1 << weekdays.Sunday,
};

export function toListDayFlags(daysOfWeek: number): ListDayFlags {
  return {
    M: Boolean(daysOfWeek & dayBit.M),
    Tu: Boolean(daysOfWeek & dayBit.Tu),
    W: Boolean(daysOfWeek & dayBit.W),
    Th: Boolean(daysOfWeek & dayBit.Th),
    F: Boolean(daysOfWeek & dayBit.F),
    Sa: Boolean(daysOfWeek & dayBit.Sa),
    Su: Boolean(daysOfWeek & dayBit.Su),
  };
}

export type WorksheetWeeklyMeeting = {
  kind: string;
  days: ListDayFlags;
  time: string;
  location: string;
  /** Index within the course's course_meetings array */
  meetingIndex: number;
};

export type WorksheetDatedMeeting = {
  kind: string;
  tone: 'midterm' | 'final' | 'neutral';
  dateLabel: string;
  time: string;
  location: string;
  daysUntil: number | null;
  /** Index within the course's course_meetings array */
  meetingIndex: number;
};

export type WorksheetItemMeetings = {
  weekly: WorksheetWeeklyMeeting[];
  dated: WorksheetDatedMeeting[];
};

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDatedMeetingDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function daysUntilDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function countdownLabel(daysUntil: number | null): string | null {
  if (daysUntil === null) return null;
  if (daysUntil < 0) return 'Past';
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export type CountdownSeverity = 'past' | 'soon' | 'upcoming' | 'later';

export function countdownSeverity(daysUntil: number | null): CountdownSeverity {
  if (daysUntil === null || daysUntil < 0) return 'past';
  if (daysUntil <= 3) return 'soon';
  if (daysUntil <= 14) return 'upcoming';
  return 'later';
}

function meetingLocation(meeting: ListItemMeeting): string {
  if (meeting.location) {
    return `${meeting.location.building.code}${
      meeting.location.room ? ` ${meeting.location.room}` : ''
    }`;
  }
  return meeting.raw_location ?? '';
}

function meetingKindLabel(meeting: ListItemMeeting): string {
  return meeting.meeting_type
    ? ucsdMeetingTypeLabel(meeting.meeting_type)
    : 'Meeting';
}

export function buildWorksheetItemMeetings(
  listing: CatalogListing,
): WorksheetItemMeetings {
  const weekly: WorksheetWeeklyMeeting[] = [];
  const dated: WorksheetDatedMeeting[] = [];

  for (const [
    meetingIndex,
    courseMeeting,
  ] of listing.course.course_meetings.entries()) {
    const meeting = courseMeeting as ListItemMeeting;
    if (meeting.date) {
      const code = ucsdMeetingTypeCode(meeting.meeting_type);
      dated.push({
        kind: meetingKindLabel(meeting),
        tone: code === 'MI' ? 'midterm' : code === 'FI' ? 'final' : 'neutral',
        dateLabel: formatDatedMeetingDate(meeting.date),
        time: formatTime(meeting.start_time, meeting.end_time),
        location: meetingLocation(meeting),
        daysUntil: daysUntilDate(meeting.date),
        meetingIndex,
      });
      continue;
    }
    weekly.push({
      kind: meetingKindLabel(meeting),
      days: toListDayFlags(meeting.days_of_week),
      time: formatTime(meeting.start_time, meeting.end_time),
      location: meetingLocation(meeting),
      meetingIndex,
    });
  }

  return { weekly, dated };
}
