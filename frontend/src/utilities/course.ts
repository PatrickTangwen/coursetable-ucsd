// Performing various actions on the listing dictionary
import { weekdays } from './constants';
import type { Courses, Listings } from '../generated/graphql-types';
import type {
  FriendRecord,
  UserWorksheets,
  CatalogListing,
} from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';
import type { SortKeys } from '../search/searchTypes';
import type { WorksheetCourse } from '../slices/WorksheetSlice';
import type { WishlistItemWithListings } from '../types/wishlist';

export function truncatedText(
  text: string | null | undefined,
  max: number,
  defaultStr: string,
) {
  if (!text) return defaultStr;
  else if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function isInWorksheet(
  listing: { crn: Crn; course: { season_code: Season } },
  worksheetNumber: number,
  worksheets: UserWorksheets | undefined,
): boolean {
  return (
    worksheets
      ?.get(listing.course.season_code)
      ?.get(worksheetNumber)
      ?.courses.some((course) => course.crn === listing.crn) ?? false
  );
}

export function isInWishlist(
  listingSameCourseId: number,
  wishlist: WishlistItemWithListings[] | undefined,
): boolean {
  if (!wishlist) return false;
  return wishlist.some(
    (wishlistItem) => wishlistItem.sameCourseId === listingSameCourseId,
  );
}

export function parseUcsdTermCode(seasonCode: Season) {
  const match = /^(?<term>fa|wi|sp|s1|s2|s3|su)(?<shortYear>\d{2})$/u.exec(
    seasonCode.toLowerCase(),
  );
  const term = match?.groups?.term;
  const shortYear = match?.groups?.shortYear;
  if (!term || !shortYear) return null;

  return {
    term,
    yearLabel: `20${shortYear}`,
    yearNumber: Number(`20${shortYear}`),
  };
}

const UCSD_TERM_RECENCY_RANK: { [term: string]: number } = {
  fa: 6,
  s3: 5,
  s2: 4,
  s1: 3,
  su: 3,
  sp: 2,
  wi: 1,
};

function legacySeasonDateValue(seasonCode: Season): number {
  const year = Number(seasonCode.substring(0, 4));
  const season = Number(seasonCode[5] ?? 0);
  return year * 10 + season;
}

export function compareSeasonsByRecency(a: Season, b: Season): number {
  const aUcsd = parseUcsdTermCode(a);
  const bUcsd = parseUcsdTermCode(b);

  if (aUcsd && bUcsd) {
    if (aUcsd.yearNumber !== bUcsd.yearNumber)
      return bUcsd.yearNumber - aUcsd.yearNumber;
    return (
      (UCSD_TERM_RECENCY_RANK[bUcsd.term] ?? 0) -
      (UCSD_TERM_RECENCY_RANK[aUcsd.term] ?? 0)
    );
  }

  if (aUcsd) return -1;
  if (bUcsd) return 1;

  return legacySeasonDateValue(b) - legacySeasonDateValue(a);
}

export function toSeasonString(seasonCode: Season): string {
  const ucsdTerm = parseUcsdTermCode(seasonCode);
  if (ucsdTerm) {
    const label =
      {
        fa: 'Fall',
        wi: 'Winter',
        sp: 'Spring',
        s1: 'Summer Session 1',
        s2: 'Summer Session 2',
        s3: 'Summer Session 3',
        su: 'Summer',
      }[ucsdTerm.term] ?? ucsdTerm.term.toUpperCase();
    return `${label} ${ucsdTerm.yearLabel}`;
  }

  const year = seasonCode.substring(0, 4);
  const season = ['Spring', 'Summer', 'Fall'][Number(seasonCode[5]) - 1]!;
  return `${season} ${year}`;
}

// A "best guess" for when the season's courses are first published.
// TODO this should be pulled from Ferry once Ferry records this info
export function toSeasonDate(seasonCode: Season): string {
  const ucsdTerm = parseUcsdTermCode(seasonCode);
  if (ucsdTerm) {
    return (
      {
        wi: `${ucsdTerm.yearNumber}-01-01`,
        sp: `${ucsdTerm.yearNumber}-03-01`,
        s1: `${ucsdTerm.yearNumber}-06-01`,
        s2: `${ucsdTerm.yearNumber}-07-01`,
        s3: `${ucsdTerm.yearNumber}-08-01`,
        su: `${ucsdTerm.yearNumber}-06-01`,
        fa: `${ucsdTerm.yearNumber}-09-01`,
      }[ucsdTerm.term] ?? `${ucsdTerm.yearNumber}-01-01`
    );
  }

  const season = Number(seasonCode[5]);
  const date = ['11-01', '01-02', '04-01'][season - 1]!;
  let year = Number(seasonCode.substring(0, 4));
  if (season === 1) year--;
  return `${year}-${date}`;
}

// Turns a bitmask of days of the week into an array of strings.
// For example, 42 = 0b101010 = Monday, Wednesday, Friday
// See constants.ts for the mapping of days of the week to numbers
export function toWeekdayStrings(daysOfWeek: number): string[] {
  return Object.entries(weekdays)
    .filter(([, day]) => daysOfWeek & (1 << day))
    .map(([d]) =>
      ['Thursday', 'Saturday', 'Sunday'].includes(d) ? d.slice(0, 2) : d[0]!,
    );
}
// The only difference with toWeekdayStrings is that it returns 'M–F' for
// Monday through Friday
export function toWeekdaysDisplayString(daysOfWeek: number): string {
  const base = toWeekdayStrings(daysOfWeek).join('');
  if (base === 'MTWThF') return 'M–F';
  return base;
}

export function toTimesSummary(
  course: Pick<CatalogListing['course'], 'course_meetings'>,
): string {
  if (!course.course_meetings.length) return 'TBA';
  const meeting = course.course_meetings[0]!;
  const days = toWeekdaysDisplayString(meeting.days_of_week);
  const summary = `${days} ${to12HourTime(meeting.start_time)}–${to12HourTime(
    meeting.end_time,
  )}`;
  return `${summary}${course.course_meetings.length > 1 ? ` + ${course.course_meetings.length - 1}` : ''}`;
}

export function toLocationsSummary(
  course: Pick<CatalogListing['course'], 'course_meetings'>,
  hasEvals?: boolean,
): string {
  // Hide locations for users without evaluation access
  if (hasEvals === false) return 'HIDDEN';
  if (hasEvals === undefined) return 'HIDDEN';

  if (course.course_meetings.every((m) => !m.location)) return 'TBA';
  const meeting = course.course_meetings[0]!;
  const summary = meeting.location
    ? `${meeting.location.building.code}${meeting.location.room ? ` ${meeting.location.room}` : ''}`
    : 'TBA';
  return `${summary}${course.course_meetings.length > 1 ? ` + ${course.course_meetings.length - 1}` : ''}`;
}

export type ListingWithTimes = {
  crn: Crn;
  course_code?: string;
  course: {
    season_code: Season;
    course_meetings: {
      days_of_week: number;
      start_time?: string | null;
      end_time?: string | null;
    }[];
  };
};

type TimedMeeting = {
  daysOfWeek: number;
  start: number;
  end: number;
};

function toTimedMeeting(
  meeting: ListingWithTimes['course']['course_meetings'][number],
): TimedMeeting | null {
  if (!meeting.days_of_week || !meeting.start_time || !meeting.end_time)
    return null;
  const start = toRangeTime(meeting.start_time);
  const end = toRangeTime(meeting.end_time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
    return null;
  return { daysOfWeek: meeting.days_of_week, start, end };
}

function timedMeetingsConflict(meeting1: TimedMeeting, meeting2: TimedMeeting) {
  if (!(meeting1.daysOfWeek & meeting2.daysOfWeek)) return false;
  return meeting1.start < meeting2.end && meeting2.start < meeting1.end;
}

export function listingsConflict(
  listing1: ListingWithTimes,
  listing2: ListingWithTimes,
): boolean {
  if (listing1.course.season_code !== listing2.course.season_code) return false;
  if (listing1.crn === listing2.crn) return false;

  const meetings1 = listing1.course.course_meetings.flatMap((meeting) => {
    const timed = toTimedMeeting(meeting);
    return timed ? [timed] : [];
  });
  const meetings2 = listing2.course.course_meetings.flatMap((meeting) => {
    const timed = toTimedMeeting(meeting);
    return timed ? [timed] : [];
  });

  return meetings1.some((meeting1) =>
    meetings2.some((meeting2) => timedMeetingsConflict(meeting1, meeting2)),
  );
}

export function checkConflict(
  worksheetData: WorksheetCourse[],
  listing: ListingWithTimes,
): CatalogListing[] {
  const conflicts: CatalogListing[] = [];
  for (const { listing: worksheetCourse } of worksheetData) {
    if (listingsConflict(worksheetCourse, listing))
      conflicts.push(worksheetCourse);
  }
  return conflicts;
}

export type WorksheetConflict = {
  courses: [CatalogListing, CatalogListing];
};

export function getWorksheetConflicts(
  worksheetData: WorksheetCourse[],
): WorksheetConflict[] {
  const conflicts: WorksheetConflict[] = [];
  for (let i = 0; i < worksheetData.length; i += 1) {
    const first = worksheetData[i]!.listing;
    for (let j = i + 1; j < worksheetData.length; j += 1) {
      const second = worksheetData[j]!.listing;
      if (listingsConflict(first, second))
        conflicts.push({ courses: [first, second] });
    }
  }
  return conflicts;
}

export function shouldHideConflictingListing(
  worksheetData: WorksheetCourse[],
  listing: ListingWithTimes,
  inWorksheet: boolean,
): boolean {
  return !inWorksheet && checkConflict(worksheetData, listing).length > 0;
}

export type NumFriendsReturn = {
  [seasonCodeCrn: `${Season}${Crn}`]: Set<string>;
};

// Checks if the course has sameCourseId
function isSameCourseIdKey(key: string): boolean {
  return !key.includes('-crn-');
}

function parseCrnKey(key: string): `${Season}${Crn}` {
  return key.replace(/-crn-/u, '') as `${Season}${Crn}`;
}

function parseSameCourseIdKey(key: string): {
  season: Season;
  sameCourseId: string;
} {
  const [season, sameCourseId] = key.split('-') as [Season, string];
  return { season, sameCourseId };
}

// Fetch the friends that are also shopping any course. Used in search and
// worksheet expanded list
export function getNumFriends(
  friends: FriendRecord,
  sameCourseIdToCrns?: { [key: string]: number[] },
): NumFriendsReturn {
  // Reverse mapping: CRN -> same_course_id
  const crnToSameCourseId = new Map<number, string>();
  if (sameCourseIdToCrns) {
    for (const [sameCourseId, crns] of Object.entries(sameCourseIdToCrns))
      for (const crn of crns) crnToSameCourseId.set(crn, sameCourseId);
  }

  // First, group friends by same_course_id + season
  const friendsBySameCourse = new Map<string, Set<string>>();

  for (const [netId, friend] of Object.entries(friends)) {
    for (const [seasonCode, worksheets] of friend.worksheets) {
      for (const w of worksheets.values()) {
        for (const course of w.courses) {
          // Prioritize sameCourseId from course data, then fall back to lookup
          const sameCourseId =
            course.sameCourseId?.toString() ??
            crnToSameCourseId.get(course.crn);
          const key =
            sameCourseId !== undefined
              ? `${seasonCode}-${sameCourseId}`
              : `${seasonCode}-crn-${course.crn}`;

          if (!friendsBySameCourse.has(key))
            friendsBySameCourse.set(key, new Set());
          friendsBySameCourse.get(key)!.add(friend.name ?? netId);
        }
      }
    }
  }

  // Now map each CRN to its friends list (grouped by same_course_id)
  const numFriends: NumFriendsReturn = {};

  for (const [sameCourseKey, friendsSet] of friendsBySameCourse.entries()) {
    if (!isSameCourseIdKey(sameCourseKey)) {
      const crnKey = parseCrnKey(sameCourseKey);
      numFriends[crnKey] = friendsSet;
    } else if (sameCourseIdToCrns) {
      const crnsForThisCourse = sameCourseIdToCrns[sameCourseKey];
      const { season } = parseSameCourseIdKey(sameCourseKey);
      if (crnsForThisCourse) {
        for (const crn of crnsForThisCourse)
          numFriends[`${season}${crn}` as `${Season}${Crn}`] = friendsSet;
      }
    }
  }
  return numFriends;
}

export type CourseWithOverall = Partial<
  Pick<Courses, 'average_rating' | 'average_rating_same_professors'>
>;

export function getOverallRatings(
  course: CourseWithOverall,
  usage: 'stat',
): number | null;
export function getOverallRatings(
  course: CourseWithOverall,
  usage: 'display',
): string;
export function getOverallRatings(
  course: CourseWithOverall,
  usage: 'stat' | 'display',
): string | number | null {
  if (course.average_rating_same_professors) {
    // Use same professor if possible
    return usage === 'stat'
      ? course.average_rating_same_professors
      : course.average_rating_same_professors.toFixed(1);
  } else if (course.average_rating) {
    // Use all professors otherwise and add tilde ~
    return usage === 'stat'
      ? course.average_rating
      : `~${course.average_rating.toFixed(1)}`;
  }
  return usage === 'stat' ? null : 'N/A';
}

export type CourseWithWorkload = Partial<
  Pick<Courses, 'average_workload' | 'average_workload_same_professors'>
>;

export function getWorkloadRatings(
  course: CourseWithWorkload,
  usage: 'stat',
): number | null;
export function getWorkloadRatings(
  course: CourseWithWorkload,
  usage: 'display',
): string;
export function getWorkloadRatings(
  course: CourseWithWorkload,
  usage: 'stat' | 'display',
): string | number | null {
  if (course.average_workload_same_professors) {
    // Use same professor if possible
    return usage === 'stat'
      ? course.average_workload_same_professors
      : course.average_workload_same_professors.toFixed(1);
  } else if (course.average_workload) {
    // Use all professors otherwise and add tilde ~
    return usage === 'stat'
      ? course.average_workload
      : `~${course.average_workload.toFixed(1)}`;
  }
  // No ratings at all
  return usage === 'stat' ? null : 'N/A';
}

export type CourseWithProfRatings = Partial<
  Pick<Courses, 'average_professor_rating'>
>;

export function getProfessorRatings(
  course: CourseWithProfRatings,
  usage: 'stat',
): number | null;
export function getProfessorRatings(
  course: CourseWithProfRatings,
  usage: 'display',
): string;
export function getProfessorRatings(
  course: CourseWithProfRatings,
  usage: 'stat' | 'display',
): string | number | null {
  if (course.average_professor_rating) {
    return usage === 'stat'
      ? course.average_professor_rating
      : course.average_professor_rating.toFixed(1);
  }
  return usage === 'stat' ? null : 'N/A';
}

export function getEnrolled(
  course: CourseWithEnrolled,
  usage: 'stat',
): number | null;
export function getEnrolled(
  course: CourseWithEnrolled,
  usage: 'display',
): string;
export function getEnrolled(
  course: CourseWithEnrolled,
  usage: 'modal',
): [string, boolean];
export function getEnrolled(
  course: CourseWithEnrolled,
  usage: 'stat' | 'display' | 'modal',
): string | number | null | [string, boolean] {
  switch (usage) {
    case 'stat':
      // Use enrollment for that season if course has happened
      if (course.evaluation_statistic?.enrolled)
        return course.evaluation_statistic.enrolled;
      if (course.last_enrollment) return course.last_enrollment;
      return null;
    case 'display':
      if (course.evaluation_statistic?.enrolled)
        return String(course.evaluation_statistic.enrolled);
      if (course.last_enrollment) {
        return course.last_enrollment_same_professors
          ? String(course.last_enrollment)
          : `~${course.last_enrollment}`;
      }
      return '';
    case 'modal':
      if (course.evaluation_statistic?.enrolled)
        return [String(course.evaluation_statistic.enrolled), true];
      if (course.last_enrollment) {
        return [
          course.last_enrollment_same_professors
            ? String(course.last_enrollment)
            : `${course.last_enrollment} (different professor was teaching)`,
          false,
        ];
      }
      return ['N/A', false];
    default:
      throw new Error('Invalid usage');
  }
}

function toDayTimeScore(
  course: Pick<CatalogListing['course'], 'course_meetings'>,
): number | null {
  if (!course.course_meetings.length) return null;
  const startTime = Number(
    course.course_meetings[0]!.start_time.split(':').join(''),
  );
  const allDays = course.course_meetings.reduce(
    (acc, m) => acc | m.days_of_week,
    0,
  );
  const firstDay = Object.values(weekdays).find((day) => allDays & (1 << day))!;
  const dayScore = firstDay * 10000;
  return dayScore + startTime;
}

type ComparableKey = SortKeys | 'season_code' | 'section';

function getAttributeValue(
  l: CatalogListing,
  key: ComparableKey,
  numFriends: NumFriendsReturn,
) {
  switch (key) {
    case 'friend':
      return numFriends[`${l.course.season_code}${l.crn}`]?.size ?? 0;
    case 'added':
      return l.course.time_added
        ? new Date(l.course.time_added as string)
        : null;
    case 'last_modified':
      return l.course.last_updated
        ? new Date(l.course.last_updated as string)
        : null;
    case 'overall':
      return getOverallRatings(l.course, 'stat');
    case 'workload':
      return getWorkloadRatings(l.course, 'stat');
    case 'enrollment':
      return getEnrolled(l.course, 'stat');
    case 'time':
      return toDayTimeScore(l.course);
    case 'location':
      return toLocationsSummary(l.course);
    case 'course_code':
      return l[key];
    case 'title':
    case 'average_professor_rating':
    case 'average_gut_rating':
    case 'season_code':
    case 'section':
    default:
      // || is intentional: 0 also means nonexistence
      return l.course[key] || null;
  }
}

function compareByKey(
  a: CatalogListing,
  b: CatalogListing,
  key: ComparableKey,
  ordering: 'asc' | 'desc',
  numFriends: NumFriendsReturn,
) {
  const aVal = getAttributeValue(a, key, numFriends);
  const bVal = getAttributeValue(b, key, numFriends);
  if (aVal === null && bVal === null) return 0;
  if (aVal === null) return 1;
  if (bVal === null) return -1;
  if (typeof aVal === 'number' && typeof bVal === 'number')
    return ordering === 'asc' ? aVal - bVal : bVal - aVal;
  if (aVal instanceof Date || bVal instanceof Date) {
    // Shouldn't happen
    if (!(aVal instanceof Date)) return ordering === 'asc' ? -1 : 1;
    else if (!(bVal instanceof Date)) return ordering === 'asc' ? 1 : -1;

    const comparison = aVal.getTime() - bVal.getTime();
    return ordering === 'asc' ? comparison : -comparison;
  }
  // Shouldn't happen
  if (typeof aVal === 'number' || typeof bVal === 'number') return 0;
  const strCmp = aVal.localeCompare(bVal, 'en-US', {
    // Use numeric sorting, so that course codes like ARCH 1002 appear after
    // ARCH 200
    numeric: true,
  });

  return ordering === 'asc' ? strCmp : -strCmp;
}

// Sort courses in catalog or expanded worksheet
export function sortCourses(
  courses: CatalogListing[],
  ordering: {
    key: SortKeys;
    type: 'desc' | 'asc';
  },
  numFriends: NumFriendsReturn,
): CatalogListing[] {
  return courses.toSorted(
    (a, b) =>
      compareByKey(a, b, ordering.key, ordering.type, numFriends) ||
      // Define a stable sort order for courses that compare equal
      compareByKey(a, b, 'season_code', 'desc', numFriends) ||
      compareByKey(a, b, 'course_code', 'asc', numFriends) ||
      compareByKey(a, b, 'section', 'asc', numFriends),
  );
}

type CourseWithEnrolled = {
  evaluation_statistic?: {
    enrolled: number;
  } | null;
  last_enrollment?: number | null;
  last_enrollment_same_professors?: boolean | null;
};

export function isGraduate(listing: Pick<Listings, 'school'>): boolean {
  return listing.school !== 'YC' && listing.school !== 'SU';
}

export function isDiscussionSection(
  listing: Pick<Courses, 'section'>,
): boolean {
  // Checks whether the section field consists only of letters -- if so, the
  // class is a discussion section.
  return /^[A-Z]*$/u.test(listing.section);
}

type WorksheetStatsCourse = {
  listing: {
    course: Pick<CatalogListing['course'], 'listings' | 'credits' | 'section'>;
  };
  hidden: boolean | null;
};

// Don't count a course in one of the following cases:
// - Cross-listing has been counted
// - Another section has been counted (we just randomly pick one)
// - Is discussion section
// - Is hidden
export function getWorksheetCourseStats(
  courses: readonly WorksheetStatsCourse[],
) {
  const countedCourseCodes = new Set<string>();
  let courseCount = 0;
  let credits = 0;
  for (const { listing, hidden } of courses) {
    const alreadyCounted = listing.course.listings.some((l) =>
      countedCourseCodes.has(l.course_code),
    );
    if (alreadyCounted || hidden || isDiscussionSection(listing.course))
      continue;
    listing.course.listings.forEach((l) => {
      countedCourseCodes.add(l.course_code);
    });
    courseCount++;
    credits += listing.course.credits ?? 0;
  }
  return { courseCount, credits };
}

/**
 * @param course a course
 * @returns section number padded to two characters or empty string if NA
 */
export function formatSectionSuffix(course: Pick<Courses, 'section'>): string {
  return isDiscussionSection(course) && course.section.length > 0
    ? ` ${course.section.padStart(2, '0')}`
    : '';
}

export function formatWorksheetSectionSuffix(
  listing: Pick<Listings, 'school'> & {
    course: Pick<Courses, 'section'>;
  },
): string {
  if (listing.school === 'UCSD' && listing.course.section.length > 0)
    return ` ${listing.course.section}`;
  return formatSectionSuffix(listing.course);
}

/**
 * @param time A time in the format `hh:mm` (24 hour)
 * @returns Number of 5 minutes past midnight
 */
export function toRangeTime(time: string): number {
  const splitTime = time.split(':');
  const hour = Number(splitTime[0]);
  const minute = Number(splitTime[1]);

  const rangeTime = hour * 12 + minute / 5;
  return rangeTime;
}

/**
 * @param time Number of 5 minutes past midnight
 * @returns A time in the format `hh:mm` (24 hour)
 */
export function toRealTime(time: number): string {
  const hour = Math.floor(time / 12);
  const minute = (time % 12) * 5;

  const realTime = `${hour}:${minute.toString().padStart(2, '0')}`;
  return realTime;
}

/**
 * @param time A time in the format `hh:mm` (24 hour)
 * @returns The same time in 12 hour, with `pm`/`am` suffix
 */
export function to12HourTime(time: string) {
  const [hour, minute] = time.split(':') as [string, string];
  let hourInt = parseInt(hour, 10);
  const ampm = hourInt >= 12 ? 'pm' : 'am';
  hourInt %= 12;
  if (hourInt === 0) hourInt = 12;
  const minuteInt = parseInt(minute, 10);
  return `${hourInt}:${minuteInt.toString().padStart(2, '0')}${ampm}`;
}

/**
 * Convert linear scale to exponential scale by taking $1.01^x$
 */
export const toExponential = (number: number): number => 1.01 ** number;

/**
 * Convert exponential scale to linear scale by taking $\log_{1.01}$
 */
export const toLinear = (number: number): number =>
  Math.log(number) / Math.log(1.01);

export function getListingId(season: Season, crn: Crn) {
  const numericSeason = Number(season);
  if (!Number.isFinite(numericSeason)) return crn;
  return (numericSeason - 200000) * 100000 + crn;
}
