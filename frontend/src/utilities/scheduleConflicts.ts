import { weekdays } from './constants';
import type { Crn } from '../queries/graphql-types';
import type { WorksheetCourse } from '../slices/WorksheetSlice';

type RawMeeting =
  WorksheetCourse['listing']['course']['course_meetings'][number] & {
    date?: string | null;
    meeting_type?: string | null;
  };

export type ConflictMeeting = {
  crn: Crn;
  courseCode: string;
  color: string;
  /** Index within the course's course_meetings array */
  meetingIndex: number;
  meetingType: string;
  daysOfWeek: number;
  /** ISO date for one-off meetings (exams); null for weekly meetings */
  date: string | null;
  startMin: number;
  endMin: number;
};

export type ScheduleConflict = {
  a: ConflictMeeting;
  b: ConflictMeeting;
  /** Weekday bitmask on which the two meetings collide */
  sharedDays: number;
  /** ISO date the collision happens on, for one-off vs one-off conflicts */
  date: string | null;
  overlapStartMin: number;
  overlapEndMin: number;
};

/** A conflict re-oriented around one course: `own` belongs to that course. */
export type CourseConflict = Omit<ScheduleConflict, 'a' | 'b'> & {
  own: ConflictMeeting;
  other: ConflictMeeting;
};

function minutesOfClock(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function isoDateWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return -1;
  return new Date(year, month - 1, day).getDay();
}

function toConflictMeetings(course: WorksheetCourse): ConflictMeeting[] {
  const { listing } = course;
  const details = (
    listing.course as { ucsd_calendar?: { meeting_type?: string | null } }
  ).ucsd_calendar;
  return listing.course.course_meetings.flatMap((raw, meetingIndex) => {
    const meeting = raw as RawMeeting;
    if (!meeting.start_time || !meeting.end_time) return [];
    const startMin = minutesOfClock(meeting.start_time);
    const endMin = minutesOfClock(meeting.end_time);
    if (startMin >= endMin) return [];
    const date = meeting.date ?? null;
    if (!date && !meeting.days_of_week) return [];
    return [
      {
        crn: listing.crn,
        courseCode: listing.course_code,
        color: course.color,
        meetingIndex,
        meetingType: meeting.meeting_type || details?.meeting_type || 'Meeting',
        daysOfWeek: meeting.days_of_week,
        date,
        startMin,
        endMin,
      },
    ];
  });
}

function meetingConflict(
  a: ConflictMeeting,
  b: ConflictMeeting,
): ScheduleConflict | null {
  if (a.startMin >= b.endMin || b.startMin >= a.endMin) return null;
  const overlap = {
    overlapStartMin: Math.max(a.startMin, b.startMin),
    overlapEndMin: Math.min(a.endMin, b.endMin),
  };
  if (a.date !== null || b.date !== null) {
    // One-off meetings only collide on the exact same date; a dated exam
    // never conflicts with a weekly meeting.
    if (a.date === null || a.date !== b.date) return null;
    const weekday = isoDateWeekday(a.date);
    return {
      a,
      b,
      sharedDays: weekday >= 0 ? 1 << weekday : 0,
      date: a.date,
      ...overlap,
    };
  }
  const sharedDays = a.daysOfWeek & b.daysOfWeek;
  if (!sharedDays) return null;
  return { a, b, sharedDays, date: null, ...overlap };
}

/**
 * Finds every pair of meetings across two different worksheet courses that
 * overlap in time. Weekly meetings collide when they share a weekday; one-off
 * (dated) meetings such as exams collide when they fall on the same date.
 */
export function getScheduleConflicts(
  courses: WorksheetCourse[],
): ScheduleConflict[] {
  const meetingsPerCourse = courses.map(toConflictMeetings);
  const conflicts: ScheduleConflict[] = [];
  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      if (courses[i]!.crn === courses[j]!.crn) continue;
      for (const a of meetingsPerCourse[i]!) {
        for (const b of meetingsPerCourse[j]!) {
          const conflict = meetingConflict(a, b);
          if (conflict) conflicts.push(conflict);
        }
      }
    }
  }
  return conflicts;
}

export function groupConflictsByCrn(
  conflicts: ScheduleConflict[],
): Map<Crn, CourseConflict[]> {
  const byCrn = new Map<Crn, CourseConflict[]>();
  const add = (crn: Crn, conflict: CourseConflict) => {
    const list = byCrn.get(crn) ?? [];
    list.push(conflict);
    byCrn.set(crn, list);
  };
  for (const { a, b, ...rest } of conflicts) {
    add(a.crn, { ...rest, own: a, other: b });
    add(b.crn, { ...rest, own: b, other: a });
  }
  return byCrn;
}

/**
 * Filters a course's conflicts down to the ones involving a specific rendered
 * calendar occurrence (one meeting on one weekday, or one dated meeting).
 */
export function getOccurrenceConflicts(
  courseConflicts: CourseConflict[],
  occurrence: {
    day: number;
    startMin: number;
    endMin: number;
    date: string | null;
  },
): CourseConflict[] {
  return courseConflicts.filter(({ own, sharedDays }) => {
    if (
      own.startMin !== occurrence.startMin ||
      own.endMin !== occurrence.endMin
    )
      return false;
    if (occurrence.date !== null) return own.date === occurrence.date;
    return own.date === null && Boolean(sharedDays & (1 << occurrence.day));
  });
}

const mondayFirstDays = [
  weekdays.Monday,
  weekdays.Tuesday,
  weekdays.Wednesday,
  weekdays.Thursday,
  weekdays.Friday,
  weekdays.Saturday,
  weekdays.Sunday,
];
const dayAbbreviations = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

export function formatConflictDays(mask: number): string {
  return mondayFirstDays
    .filter((day) => mask & (1 << day))
    .map((day) => dayAbbreviations[day])
    .join(' ');
}

function formatMinuteClock(min: number): { display: string; period: string } {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return {
    display:
      minute === 0 ? String(h) : `${h}:${String(minute).padStart(2, '0')}`,
    period: hour < 12 ? 'AM' : 'PM',
  };
}

export function formatMinuteRange(startMin: number, endMin: number): string {
  const start = formatMinuteClock(startMin);
  const end = formatMinuteClock(endMin);
  return start.period === end.period
    ? `${start.display} – ${end.display} ${end.period}`
    : `${start.display} ${start.period} – ${end.display} ${end.period}`;
}

export function formatConflictDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

/** E.g. "Tu Th · 9:30 – 10:20 AM" or "Dec 12 · 3 – 4 PM" for dated meetings */
export function describeConflictSlot(conflict: {
  sharedDays: number;
  date: string | null;
  overlapStartMin: number;
  overlapEndMin: number;
}): string {
  const range = formatMinuteRange(
    conflict.overlapStartMin,
    conflict.overlapEndMin,
  );
  const when =
    conflict.date !== null
      ? formatConflictDate(conflict.date)
      : formatConflictDays(conflict.sharedDays);
  return when ? `${when} · ${range}` : range;
}

/** E.g. "MATH 20C Lecture · Tu Th · 9:30 – 10:20 AM" */
export function describeCourseConflict(conflict: CourseConflict): string {
  return `${conflict.other.courseCode} ${conflict.other.meetingType} · ${describeConflictSlot(conflict)}`;
}

export type ConflictPairSummary = {
  key: string;
  courseCodes: [string, string];
  crns: [Crn, Crn];
  details: string[];
};

/**
 * Groups meeting-level conflicts into course pairs for compact banner
 * display, with one detail line per colliding meeting pair.
 */
export function summarizeConflictPairs(
  conflicts: ScheduleConflict[],
): ConflictPairSummary[] {
  const pairs = new Map<string, ConflictPairSummary>();
  for (const conflict of conflicts) {
    const [x, y] =
      conflict.a.courseCode <= conflict.b.courseCode
        ? [conflict.a, conflict.b]
        : [conflict.b, conflict.a];
    const key = `${x.crn}|${y.crn}`;
    const slot = describeConflictSlot(conflict);
    const detail =
      conflict.date !== null && x.meetingType === y.meetingType
        ? `${x.meetingType} · ${slot}`
        : slot;
    const pair = pairs.get(key) ?? {
      key,
      courseCodes: [x.courseCode, y.courseCode] as [string, string],
      crns: [x.crn, y.crn] as [Crn, Crn],
      details: [],
    };
    if (!pair.details.includes(detail)) pair.details.push(detail);
    pairs.set(key, pair);
  }
  return [...pairs.values()].sort((p, q) => p.key.localeCompare(q.key));
}
