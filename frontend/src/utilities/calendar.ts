import { DateLocalizer, type DateLocalizerSpec } from 'react-big-calendar';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { weekdays } from './constants';
import { toSeasonString } from './course';
import {
  academicCalendars,
  type SimpleDate,
  type SeasonCalendar,
} from '../config';
import type { CatalogListing } from '../queries/api';
import type { Season } from '../queries/graphql-types';
import type { WorksheetCourse } from '../slices/WorksheetSlice';

/**
 * The string never has the time zone offset, but it should always be Eastern
 * time.
 */
function isoString(date: Date | SimpleDate, time?: string) {
  const d = Array.isArray(date)
    ? new Date(Date.UTC(date[0], date[1] - 1, date[2]))
    : // Avoid mutations
      new Date(date);
  if (time) {
    const [hourString, minuteString] = time.split(':') as [string, string];
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);
    d.setUTCHours(hour);
    d.setUTCMinutes(minute);
  }
  return d.toISOString().substring(0, 'YYYY-MM-DDTHH:mm:ss'.length);
}

/**
 * For example, it finds the first Tuesday/Thursday after the semester starts,
 * whichever is earlier. If semester also starts on Tuesday, it returns the
 * same Tuesday.
 *
 * @param reference A day that is less than a week ago away from the date in
 * question.
 * @param days Day of the week, 1–5. Will return the day in the list that leads
 * to the earliest date.
 * @returns The date in question.
 */
function firstDaySince(reference: Date | SimpleDate, days: number[]) {
  const referenceDate = new Date(
    Array.isArray(reference)
      ? Date.UTC(reference[0], reference[1] - 1, reference[2])
      : reference,
  );
  const offsets = days.map(
    (day) => (((day - referenceDate.getUTCDay()) % 7) + 7) % 7, // Positive offset (0–6)
  );
  const offset = Math.min(...offsets);
  referenceDate.setUTCDate(referenceDate.getUTCDate() + offset);
  return referenceDate;
}

const dayToCode: { [key: number]: string } = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

function datesInBreak(
  breaks: SeasonCalendar['breaks'],
  days: number[],
  time: string,
) {
  return breaks.flatMap((b) => {
    const start = new Date(Date.UTC(b.start[0], b.start[1] - 1, b.start[2]));
    const end = Date.UTC(b.end[0], b.end[1] - 1, b.end[2]);
    const dates: string[] = [];
    for (
      const date = start;
      date.getTime() <= end;
      date.setUTCDate(date.getUTCDate() + 1)
    )
      if (days.includes(date.getUTCDay())) dates.push(isoString(date, time));
    return dates;
  });
}

function transferDays(
  transfers: SeasonCalendar['transfers'],
  days: number[],
  time: string,
) {
  return transfers.map((t) => {
    const day = new Date(Date.UTC(t.date[0], t.date[1] - 1, t.date[2]));
    if (days.includes(t.day)) return isoString(day, time);
    return '';
  });
}

/**
 * A usage-agnostic representation of a calendar event. It will be converted to
 * a usable format by one of the `to*Event` functions.
 */
type CalendarEvent = {
  summary: string;
  start: string;
  end: string;
  recurrence: string[];
  description: string;
  location: string;
  color: string;
  listing: CatalogListing;
  days: number[];
  meetingType: string;
  section: string;
  /** ISO date for one-off (dated) meetings such as exams; null if recurring */
  date: string | null;
};

function toGCalEvent({
  summary,
  start,
  end,
  recurrence,
  description,
  location,
}: CalendarEvent): GCalEvent {
  return {
    id: `coursetable${uuidv4().replace(/-/gu, '')}`,
    summary,
    start: {
      dateTime: start,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: end,
      timeZone: 'America/New_York',
    },
    recurrence,
    description,
    location,
  };
}

function toICSEvent({
  summary,
  start,
  end,
  recurrence,
  description,
  location,
  color,
}: CalendarEvent): ICSEvent {
  return `BEGIN:VEVENT
COLOR:${color}
DESCRIPTION:${
    // ICS uses **CRLF**
    description.replaceAll('\n', '\\r\\n')
  }
DTEND;TZID=America/New_York:${end.replace(/[:-]/gu, '')}
DTSTART;TZID=America/New_York:${start.replace(/[:-]/gu, '')}
LOCATION:${location}
${recurrence.join('\n')}
SUMMARY:${summary}
TRANSP:OPAQUE
END:VEVENT`;
}

function toRBCEvent({
  summary,
  start,
  end,
  location,
  color,
  listing,
  days,
  meetingType,
  section,
  date,
}: CalendarEvent): CourseRBCEvent[] {
  // These are already LOCAL times because the time strings have no timezone!
  const firstStart = new Date(start);
  const firstEnd = new Date(end);
  // RBC requires all events to be within *the current* week
  const startTime = new Date();
  startTime.setHours(firstStart.getHours(), firstStart.getMinutes(), 0, 0);
  const endTime = new Date();
  endTime.setHours(firstEnd.getHours(), firstEnd.getMinutes(), 0, 0);
  return days.map((day) => {
    const startTimeCpy = new Date(startTime);
    startTimeCpy.setDate(startTimeCpy.getDate() - startTimeCpy.getDay() + day);
    const endTimeCpy = new Date(endTime);
    endTimeCpy.setDate(endTimeCpy.getDate() - endTimeCpy.getDay() + day);
    return {
      kind: 'course',
      title: summary,
      // No instructors for RBC
      description: listing.course.title,
      start: startTimeCpy,
      end: endTimeCpy,
      listing,
      color,
      location,
      meetingType,
      section,
      day,
      date,
    };
  });
}

type GCalEvent = gapi.client.calendar.EventInput;
type ICSEvent = string;
type CalendarType = 'gcal' | 'ics' | 'rbc';
type CalendarExportOptions = {
  notify?: boolean;
};

type UcsdCalendarMeeting = {
  days: string[];
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  is_tba: boolean;
  raw_days: string | null;
  raw_time: string | null;
  raw_location: string | null;
};

type UcsdCalendarDetails = {
  term_date_range?: {
    start: string;
    end: string;
  };
  section_id?: string;
  section_code?: string | null;
  meeting_type?: string | null;
  meetings?: UcsdCalendarMeeting[];
  source_note?: string | null;
};

type CourseWithCalendarDetails = CatalogListing['course'] & {
  ucsd_calendar?: UcsdCalendarDetails;
};

type CourseMeeting = CatalogListing['course']['course_meetings'][number] & {
  date?: string | null;
  meeting_type?: string | null;
  raw_location?: string | null;
};

export type CourseRBCEvent = {
  kind: 'course';
  title: string;
  description: string;
  start: Date;
  end: Date;
  listing: CatalogListing;
  color: string;
  location: string;
  meetingType: string;
  section: string;
  /** Day of week (0 = Sunday … 6 = Saturday) this occurrence falls on */
  day: number;
  /** ISO date for one-off (dated) meetings such as exams; null if recurring */
  date: string | null;
  walkBefore?: WalkBefore;
};

export type WalkClassSummary = {
  courseCode: string;
  courseTitle: string;
  location: string;
  start: Date;
  end: Date;
  color: string;
};

export type WalkBefore = {
  minutes: number;
  gapMinutes: number;
  fromCode: string;
  toCode: string;
  fromClass: WalkClassSummary;
  toClass: WalkClassSummary;
};

export type CalendarSkippedMeeting = {
  courseCode: string;
  section: string;
  meetingType: string;
  rawDays: string | null;
  rawTime: string | null;
  rawLocation: string | null;
  reason: string;
};

type CalendarExportResult<T> = {
  events: T[];
  skippedMeetings: CalendarSkippedMeeting[];
};

function ucsdCalendarDetails(listing: CatalogListing) {
  return (listing.course as CourseWithCalendarDetails).ucsd_calendar;
}

function simpleDateFromIso(value: string): SimpleDate | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return [year, month, day];
}

function calendarFromTermDateRange(
  range: UcsdCalendarDetails['term_date_range'],
): SeasonCalendar | undefined {
  if (!range) return undefined;
  const start = simpleDateFromIso(range.start);
  const end = simpleDateFromIso(range.end);
  if (!start || !end) return undefined;
  return {
    start,
    end,
    breaks: [],
    transfers: [],
  };
}

function getExportCalendar(
  visibleCourses: WorksheetCourse[],
  viewedSeason: Season,
): SeasonCalendar | undefined {
  for (const course of visibleCourses) {
    const semester = calendarFromTermDateRange(
      ucsdCalendarDetails(course.listing)?.term_date_range,
    );
    if (semester) return semester;
  }
  return academicCalendars[viewedSeason] as SeasonCalendar | undefined;
}

function sectionLabel(listing: CatalogListing) {
  const details = ucsdCalendarDetails(listing);
  return (
    details?.section_code || listing.course.section || details?.section_id || ''
  );
}

function meetingTypeLabel(listing: CatalogListing, meeting?: CourseMeeting) {
  return (
    meeting?.meeting_type ||
    ucsdCalendarDetails(listing)?.meeting_type ||
    'Meeting'
  );
}

function sourceNote(listing: CatalogListing) {
  return ucsdCalendarDetails(listing)?.source_note || '';
}

function eventSummary(listing: CatalogListing, meeting?: CourseMeeting) {
  return [
    listing.course_code,
    sectionLabel(listing),
    meetingTypeLabel(listing, meeting),
  ]
    .filter(Boolean)
    .join(' ');
}

function instructorNames(listing: CatalogListing) {
  return listing.course.course_professors
    .map((p) => p.professor.name)
    .filter(Boolean)
    .join(', ');
}

function meetingLocation(meeting: CourseMeeting) {
  if (meeting.location) {
    return `${meeting.location.building.code}${
      meeting.location.room ? ` ${meeting.location.room}` : ''
    }`;
  }
  return meeting.raw_location ?? '';
}

function eventDescription(
  listing: CatalogListing,
  location: string,
  meeting?: CourseMeeting,
) {
  const lines = [
    `Course: ${listing.course_code}`,
    sectionLabel(listing) ? `Section: ${sectionLabel(listing)}` : '',
    `Meeting type: ${meetingTypeLabel(listing, meeting)}`,
    `Title: ${listing.course.title}`,
    instructorNames(listing) ? `Instructor: ${instructorNames(listing)}` : '',
    location ? `Location: ${location}` : '',
    sourceNote(listing) ? `Source: ${sourceNote(listing)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function skippedMeetingFromSource(
  listing: CatalogListing,
  meeting: UcsdCalendarMeeting,
): CalendarSkippedMeeting {
  const rawLocation =
    meeting.raw_location ||
    [meeting.building, meeting.room].filter(Boolean).join(' ');
  return {
    courseCode: listing.course_code,
    section: sectionLabel(listing),
    meetingType: meetingTypeLabel(listing),
    rawDays: meeting.raw_days,
    rawTime: meeting.raw_time,
    rawLocation: rawLocation || null,
    reason: 'TBA or arranged Meeting',
  };
}

function skippedMeetingFromCourseMeeting(
  listing: CatalogListing,
  meeting: CourseMeeting,
): CalendarSkippedMeeting {
  return {
    courseCode: listing.course_code,
    section: sectionLabel(listing),
    meetingType: meetingTypeLabel(listing),
    rawDays: null,
    rawTime:
      meeting.start_time && meeting.end_time
        ? `${meeting.start_time}-${meeting.end_time}`
        : null,
    rawLocation: meetingLocation(meeting) || null,
    reason: 'TBA or arranged Meeting',
  };
}

function sourceSkippedMeetings(listing: CatalogListing) {
  const meetings = ucsdCalendarDetails(listing)?.meetings ?? [];
  return meetings
    .filter(
      (meeting) =>
        meeting.is_tba ||
        meeting.days.length === 0 ||
        !meeting.start_time ||
        !meeting.end_time,
    )
    .map((meeting) => skippedMeetingFromSource(listing, meeting));
}

function skippedLabel(meeting: CalendarSkippedMeeting) {
  const raw =
    meeting.rawTime || meeting.rawDays || meeting.rawLocation || undefined;
  const label = [meeting.courseCode, meeting.section, meeting.meetingType]
    .filter(Boolean)
    .join(' ');
  return raw ? `${label} (${raw})` : label;
}

export function formatSkippedMeetingsSummary(
  skippedMeetings: CalendarSkippedMeeting[],
) {
  if (skippedMeetings.length === 0) return '';
  return `Skipped ${skippedMeetings.length} TBA or arranged Meeting${
    skippedMeetings.length === 1 ? '' : 's'
  }: ${skippedMeetings.map(skippedLabel).join('; ')}.`;
}

export function getCalendarEvents(
  type: 'gcal',
  courses: WorksheetCourse[],
  viewedSeason: Season,
): GCalEvent[];
export function getCalendarEvents(
  type: 'ics',
  courses: WorksheetCourse[],
  viewedSeason: Season,
): ICSEvent[];
export function getCalendarEvents(
  type: 'rbc',
  courses: WorksheetCourse[],
  viewedSeason: Season,
): CourseRBCEvent[];
export function getCalendarEvents(
  type: CalendarType,
  courses: WorksheetCourse[],
  viewedSeason: Season,
) {
  return getCalendarExport(type, courses, viewedSeason).events;
}

export function getCalendarExport(
  type: 'gcal',
  courses: WorksheetCourse[],
  viewedSeason: Season,
  options?: CalendarExportOptions,
): CalendarExportResult<GCalEvent>;
export function getCalendarExport(
  type: 'ics',
  courses: WorksheetCourse[],
  viewedSeason: Season,
  options?: CalendarExportOptions,
): CalendarExportResult<ICSEvent>;
export function getCalendarExport(
  type: 'rbc',
  courses: WorksheetCourse[],
  viewedSeason: Season,
  options?: CalendarExportOptions,
): CalendarExportResult<CourseRBCEvent>;
export function getCalendarExport(
  type: CalendarType,
  courses: WorksheetCourse[],
  viewedSeason: Season,
  options?: CalendarExportOptions,
): CalendarExportResult<GCalEvent | ICSEvent | CourseRBCEvent>;
export function getCalendarExport(
  type: CalendarType,
  courses: WorksheetCourse[],
  viewedSeason: Season,
  options: CalendarExportOptions = {},
) {
  const notify = options.notify ?? true;
  const seasonString = toSeasonString(viewedSeason);
  const visibleCourses = courses.filter((course) => !course.hidden);
  const skippedMeetings = visibleCourses.flatMap(({ listing }) =>
    sourceSkippedMeetings(listing),
  );

  if (visibleCourses.length === 0) {
    if (notify && type !== 'rbc')
      toast.error(`No courses in ${seasonString} to export!`);
    return { events: [], skippedMeetings };
  }
  const semester = getExportCalendar(visibleCourses, viewedSeason);
  if (!semester && type !== 'rbc') {
    if (!notify) return { events: [], skippedMeetings };
    toast.error(
      `Can't construct calendar events for ${seasonString} because there is no academic calendar available.`,
    );
    return { events: [], skippedMeetings };
  }
  const toEvent =
    type === 'gcal' ? toGCalEvent : type === 'ics' ? toICSEvent : toRBCEvent;
  const events = visibleCourses.flatMap(({ listing: l, color }) => {
    const endRepeat = semester
      ? isoString(semester.end, '23:59').replace(/[:-]/gu, '')
      : // Irrelevant for rbc
        '';
    return l.course.course_meetings.flatMap<
      GCalEvent | ICSEvent | CourseRBCEvent
    >((courseMeeting) => {
      const {
        days_of_week: daysOfWeek,
        start_time: startTime,
        end_time: endTime,
      } = courseMeeting;
      const meeting = courseMeeting as CourseMeeting;
      const meetingDate = meeting.date
        ? simpleDateFromIso(meeting.date)
        : undefined;
      const days = Object.values(weekdays).filter(
        (day) => daysOfWeek & (1 << day),
      );
      if ((!meetingDate && days.length === 0) || !startTime || !endTime) {
        skippedMeetings.push(skippedMeetingFromCourseMeeting(l, meeting));
        return [];
      }
      const location = meetingLocation(meeting);

      if (meetingDate) {
        const dateWeekday = new Date(
          Date.UTC(meetingDate[0], meetingDate[1] - 1, meetingDate[2]),
        ).getUTCDay();
        return toEvent({
          summary: eventSummary(l, meeting),
          start: isoString(meetingDate, startTime),
          end: isoString(meetingDate, endTime),
          recurrence: [],
          description: eventDescription(l, location, meeting),
          location,
          color,
          listing: l,
          days: days.length > 0 ? days : [dateWeekday],
          meetingType: meetingTypeLabel(l, meeting),
          section: sectionLabel(l),
          date: meeting.date ?? null,
        });
      }

      const firstMeetingDay = semester
        ? firstDaySince(semester.start, days)
        : // Irrelevant for rbc, because it always uses the current date
          new Date();
      const byDay = days.map((day) => dayToCode[day]).join(',');
      const exDate = semester
        ? datesInBreak(semester.breaks, days, startTime)
            .map((s) => s.replace(/[:-]/gu, ''))
            .join(',')
        : // Irrelevant for rbc
          '';
      const rDate = semester
        ? transferDays(semester.transfers, days, startTime)
            .map((s) => s.replace(/[:-]/gu, ''))
            .join(',')
        : // Irrelevant for rbc
          '';

      return toEvent({
        summary: eventSummary(l, meeting),
        start: isoString(firstMeetingDay, startTime),
        end: isoString(firstMeetingDay, endTime),
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${endRepeat}Z`,
          `EXDATE;TZID=America/New_York:${exDate}`,
          ...(rDate ? [`RDATE;TZID=America/New_York:${rDate}`] : []),
        ],
        description: eventDescription(l, location, meeting),
        location,
        color,
        listing: l,
        days,
        meetingType: meetingTypeLabel(l, meeting),
        section: sectionLabel(l),
        date: null,
      });
    });
  });
  return { events, skippedMeetings };
}

function formatTime(a: Date) {
  const hours = a.getHours();
  const minutes = a.getMinutes();
  return `${((hours - 1) % 12) + 1}${
    minutes ? `:${minutes.toString().padStart(2, '0')}` : ''
  }${hours < 12 ? 'a' : 'p'}m`;
}

export const localizer = new DateLocalizer({
  firstOfWeek() {
    return 0;
  },
  format() {
    // Everything is already in formats
    return '';
  },
  formats: {
    dayFormat: (a) =>
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][a.getDay()]!,
    timeGutterFormat: (a) => formatTime(a),
    selectRangeFormat: ({ start, end }) =>
      `${formatTime(start)} – ${formatTime(end)}`,
    eventTimeRangeFormat: ({ start, end }) =>
      `${formatTime(start)} – ${formatTime(end)}`,
    eventTimeRangeStartFormat: ({ start }) => `${formatTime(start)} – `,
    eventTimeRangeEndFormat: ({ end }) => ` – ${formatTime(end)}`,
  },
} satisfies Pick<
  DateLocalizerSpec,
  'firstOfWeek' | 'format' | 'formats'
> as unknown as DateLocalizerSpec);
