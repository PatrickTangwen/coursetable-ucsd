import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { ucsdMeetingTypeCode } from '../CourseModal/ucsdMeetingTypes';

/** Credit-load rating per the finalized list-view design. */
export function creditLoad(credits: number) {
  if (credits >= 17) return { label: 'Heavy', color: '#a32d2d' };
  if (credits >= 12) return { label: 'Moderate', color: '#ba7517' };
  return { label: 'Light', color: '#3b6d11' };
}

const examDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

type RawMeeting =
  WorksheetCourse['listing']['course']['course_meetings'][number] & {
    date?: string | null;
    meeting_type?: string | null;
  };

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function minutesOfClock(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function isExamCode(meetingType: string | null | undefined) {
  const code = ucsdMeetingTypeCode(meetingType);
  return code === 'FI' || code === 'MI';
}

/** Nearest upcoming exam (midterm or final) among the given courses. */
export function firstExam(courses: readonly WorksheetCourse[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let first: Date | null = null;
  for (const course of courses) {
    for (const raw of course.listing.course.course_meetings) {
      const meeting = raw as RawMeeting;
      if (!meeting.date || !isExamCode(meeting.meeting_type)) continue;
      const date = parseIsoDate(meeting.date);
      if (!date || date < today) continue;
      if (!first || date < first) first = date;
    }
  }
  if (!first) return null;
  const daysUntil = Math.round(
    (first.getTime() - today.getTime()) / 86_400_000,
  );
  const countdown =
    daysUntil === 0
      ? 'Today'
      : daysUntil === 1
        ? 'Tomorrow'
        : `in ${daysUntil}d`;
  return { daysUntil, countdown, dateShort: examDateFormat.format(first) };
}

/** Whether any course has a scheduled midterm or final, past ones included. */
export function hasAnyExam(courses: readonly WorksheetCourse[]) {
  return courses.some((course) =>
    course.listing.course.course_meetings.some((raw) => {
      const meeting = raw as RawMeeting;
      return Boolean(meeting.date) && isExamCode(meeting.meeting_type);
    }),
  );
}

const shortDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Mon–Fri weekday with the most weekly class meetings. */
export function busiestDay(courses: readonly WorksheetCourse[]) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const course of courses) {
    for (const raw of course.listing.course.course_meetings) {
      const meeting = raw as RawMeeting;
      if (meeting.date || !raw.days_of_week) continue;
      for (let day = 0; day < 7; day++)
        if (raw.days_of_week & (1 << day)) counts[day]! += 1;
    }
  }
  let bestDay = 0;
  let bestCount = 0;
  for (let day = 1; day <= 5; day++) {
    if (counts[day]! > bestCount) {
      bestCount = counts[day]!;
      bestDay = day;
    }
  }
  if (bestCount === 0) return null;
  return { label: shortDayLabels[bestDay]!, count: bestCount };
}

export type WeeklyLoadSegment = {
  crn: Crn;
  color: string;
  minutes: number;
};

export type WeeklyLoadDay = {
  label: string;
  minutes: number;
  segments: WeeklyLoadSegment[];
};

export type WeeklyLoad = {
  /** Mon–Fri, in order */
  days: WeeklyLoadDay[];
  totalMinutes: number;
  legend: { crn: Crn; color: string; code: string }[];
};

const chartDayLabels = ['M', 'Tu', 'W', 'Th', 'F'];

/** Minutes of weekly (non-exam) class time per weekday, stacked by course. */
export function buildWeeklyLoad(
  courses: readonly WorksheetCourse[],
): WeeklyLoad {
  // Index 0 = Monday … 4 = Friday
  const days: WeeklyLoadDay[] = chartDayLabels.map((label) => ({
    label,
    minutes: 0,
    segments: [],
  }));
  const legend: WeeklyLoad['legend'] = [];
  let totalMinutes = 0;

  for (const course of courses) {
    let hasWeekly = false;
    for (const raw of course.listing.course.course_meetings) {
      const meeting = raw as RawMeeting;
      if (meeting.date || !raw.days_of_week) continue;
      if (!raw.start_time || !raw.end_time) continue;
      const duration =
        minutesOfClock(raw.end_time) - minutesOfClock(raw.start_time);
      if (duration <= 0) continue;
      for (let weekday = 1; weekday <= 5; weekday++) {
        if (!(raw.days_of_week & (1 << weekday))) continue;
        const day = days[weekday - 1]!;
        day.minutes += duration;
        totalMinutes += duration;
        const last = day.segments.at(-1);
        if (last && last.crn === course.listing.crn) {
          last.minutes += duration;
        } else {
          day.segments.push({
            crn: course.listing.crn,
            color: course.color,
            minutes: duration,
          });
        }
        hasWeekly = true;
      }
    }
    if (hasWeekly) {
      legend.push({
        crn: course.listing.crn,
        color: course.color,
        code: course.listing.course_code,
      });
    }
  }

  return { days, totalMinutes, legend };
}

export function formatHours(minutes: number) {
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}
