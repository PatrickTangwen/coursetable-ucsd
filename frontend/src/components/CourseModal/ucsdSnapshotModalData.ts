import type { CourseModalPrefetchListingDataFragment } from '../../generated/graphql-types';
import type { CatalogListing } from '../../queries/api';
import type {
  UcsdCalendarDetails,
  UcsdCourseArchive,
} from '../../queries/ucsdCatalogSnapshot';
import {
  buildOfferingGroups,
  seatsColor,
  type OfferingGroup,
  type SeatsStatus,
} from '../../utilities/catalogView';

export { formatSnapshotStalenessLabel } from '../../utilities/catalogFreshness';

export type UcsdModalListing =
  | CatalogListing
  | CourseModalPrefetchListingDataFragment;

export type UcsdModalSection = OfferingGroup['sections'][number] & {
  listing: UcsdModalListing;
};

export type UcsdModalOfferingGroup = Omit<OfferingGroup, 'sections'> & {
  sections: UcsdModalSection[];
};

export type UcsdSnapshotModalCourse = {
  listings: UcsdModalListing[];
  groups: UcsdModalOfferingGroup[];
  activeFamily: string;
  selectedSectionCode: string | null;
};

export type UcsdAvailabilityStatus = SeatsStatus | 'full';

export type UcsdAvailabilityDisplay = {
  main: string;
  detail: string;
  status: UcsdAvailabilityStatus;
};

type CalendarLike = Omit<UcsdCalendarDetails, 'waitlist_count'> & {
  waitlist_count: number | null;
};

type UcsdModalMeeting = UcsdModalSection['meetings'][number];

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null;
}

function getCalendar(listing: UcsdModalListing): CalendarLike | undefined {
  const course = listing.course as { [key: string]: unknown };
  return isRecord(course.ucsd_calendar)
    ? (course.ucsd_calendar as CalendarLike)
    : undefined;
}

function getListingSectionId(listing: UcsdModalListing): string {
  const direct = (listing as { section_id?: unknown }).section_id;
  if (typeof direct === 'string' && direct) return direct;
  const match = listing.course.listings.find((l) => l.crn === listing.crn);
  const fromCourseListing = (match as { section_id?: unknown } | undefined)
    ?.section_id;
  if (typeof fromCourseListing === 'string' && fromCourseListing)
    return fromCourseListing;
  return String(listing.crn);
}

export function getUcsdModalSectionFamily(
  sectionCode: string | null | undefined,
): string {
  if (!sectionCode) return '';
  const [first] = sectionCode;
  if (first && /[A-Za-z]/u.test(first)) return first.toUpperCase();
  return sectionCode;
}

function normalizeWaitlist(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toModalSection(listing: UcsdModalListing): UcsdModalSection {
  const calendar = getCalendar(listing);
  const fallbackMeetings = listing.course.course_meetings.map((meeting) => ({
    days: [] as string[],
    date: null,
    start_time: meeting.start_time,
    end_time: meeting.end_time,
    building:
      (
        meeting as {
          location?: { building?: { code?: string | null } | null } | null;
        }
      ).location?.building?.code ?? null,
    room:
      (meeting as { location?: { room?: string | null } | null }).location
        ?.room ?? null,
    is_tba: false,
    meeting_type: (meeting as { meeting_type?: string | null }).meeting_type,
    raw_days: null,
    raw_time: null,
    raw_location: (meeting as { raw_location?: string | null }).raw_location,
  }));

  return {
    section_id: String(calendar?.section_id ?? getListingSectionId(listing)),
    course_id: String(listing.course.same_course_id),
    section_code: calendar?.section_code ?? listing.course.section,
    meeting_type: calendar?.meeting_type ?? null,
    instructors: listing.course.course_professors
      .map(
        ({ professor }) => (professor as { name?: string | null }).name ?? null,
      )
      .filter((name): name is string => Boolean(name)),
    meetings: calendar?.meetings ?? fallbackMeetings,
    enrolled: calendar?.enrolled ?? null,
    capacity: calendar?.capacity ?? null,
    waitlist_count: normalizeWaitlist(calendar?.waitlist_count),
    listing,
  };
}

function sameCourse(a: UcsdModalListing, b: UcsdModalListing): boolean {
  return (
    a.course.season_code === b.course.season_code &&
    a.course.same_course_id === b.course.same_course_id &&
    a.course_code === b.course_code
  );
}

function sectionSortValue(listing: UcsdModalListing): string {
  const calendar = getCalendar(listing);
  return calendar?.section_code ?? listing.course.section;
}

export function buildUcsdSnapshotModalCourse(
  currentListing: UcsdModalListing,
  allListings: readonly UcsdModalListing[] = [],
): UcsdSnapshotModalCourse {
  const bySection = new Map<string, UcsdModalListing>();
  for (const listing of [currentListing, ...allListings]) {
    if (!sameCourse(currentListing, listing)) continue;
    bySection.set(getListingSectionId(listing), listing);
  }

  const listings = [...bySection.values()].sort((a, b) =>
    sectionSortValue(a).localeCompare(sectionSortValue(b), 'en-US', {
      numeric: true,
      sensitivity: 'base',
    }),
  );
  const sections = listings.map(toModalSection);
  const groups = buildOfferingGroups(sections) as UcsdModalOfferingGroup[];
  const selectedSectionCode =
    getCalendar(currentListing)?.section_code ?? currentListing.course.section;
  const activeFamily =
    getUcsdModalSectionFamily(selectedSectionCode) ||
    groups[0]?.familyPrefix ||
    '';

  return {
    listings,
    groups,
    activeFamily,
    selectedSectionCode,
  };
}

function meetingKey(meeting: UcsdModalMeeting): string {
  return [
    meeting.meeting_type ?? '',
    meeting.date ?? '',
    meeting.raw_days ?? meeting.days.join(','),
    meeting.start_time ?? '',
    meeting.end_time ?? '',
    meeting.raw_location ?? '',
    meeting.building ?? '',
    meeting.room ?? '',
  ].join('|');
}

export function getSectionVaryingMeetings(
  section: UcsdModalSection,
  group: UcsdModalOfferingGroup,
): UcsdModalSection['meetings'] {
  const sharedKeys = new Set(group.sharedMeetings.map(meetingKey));
  const varying = section.meetings.filter(
    (meeting) => !sharedKeys.has(meetingKey(meeting)),
  );
  return varying.length > 0 ? varying : section.meetings.slice(0, 1);
}

export function formatUcsdAvailability(
  enrolled: number | null,
  capacity: number | null,
  waitlistCount = 0,
): UcsdAvailabilityDisplay {
  if (enrolled === null || capacity === null || capacity <= 0) {
    return {
      main: 'Seats TBA',
      detail: '',
      status: 'available',
    };
  }

  if (enrolled >= capacity) {
    return {
      main: waitlistCount > 0 ? `FULL · WL(${waitlistCount})` : 'FULL',
      detail: '',
      status: 'full',
    };
  }

  const remaining = capacity - enrolled;
  return {
    main: `${remaining} ${remaining === 1 ? 'seat' : 'seats'} left`,
    detail: '',
    status: seatsColor(enrolled, capacity),
  };
}

type UcsdGradeArchiveRecord =
  UcsdCourseArchive['grade_archive_records'][number];

const archiveQuarterRank: { [quarter: string]: number } = {
  WI: 1,
  WN: 1,
  SP: 2,
  S1: 3,
  SS1: 3,
  SU1: 3,
  S2: 4,
  SS2: 4,
  SU2: 4,
  S3: 5,
  SS: 5,
  SS3: 5,
  SU: 5,
  SU3: 5,
  FA: 6,
};

function archiveYearValue(year: string): number | null {
  const parsed = Number.parseInt(year.trim(), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 100 ? 2000 + parsed : parsed;
}

function compareArchiveTerm(
  a: UcsdGradeArchiveRecord,
  b: UcsdGradeArchiveRecord,
) {
  const yearA = archiveYearValue(a.year);
  const yearB = archiveYearValue(b.year);
  if (yearA !== null && yearB !== null && yearA !== yearB) return yearA - yearB;
  if (yearA !== null && yearB === null) return 1;
  if (yearA === null && yearB !== null) return -1;
  if (yearA === null && yearB === null) {
    const yearComparison = a.year.localeCompare(b.year, 'en-US', {
      numeric: true,
      sensitivity: 'base',
    });
    if (yearComparison !== 0) return yearComparison;
  }

  const quarterA = a.quarter.trim().toUpperCase();
  const quarterB = b.quarter.trim().toUpperCase();
  const rankA = archiveQuarterRank[quarterA] ?? 0;
  const rankB = archiveQuarterRank[quarterB] ?? 0;
  if (rankA !== rankB) return rankA - rankB;
  return quarterA.localeCompare(quarterB, 'en-US', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortArchiveRecordsByTermDescending(
  records: UcsdCourseArchive['grade_archive_records'],
): UcsdCourseArchive['grade_archive_records'] {
  return [...records].sort((a, b) => compareArchiveTerm(b, a));
}

export function formatSnapshotUpdatedLabel(
  generatedAt: string | null | undefined,
  now = new Date(),
): string | null {
  if (!generatedAt) return null;
  const generatedDate = new Date(generatedAt);
  if (Number.isNaN(generatedDate.getTime())) return null;
  const elapsedMs = now.getTime() - generatedDate.getTime();
  const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated 1 day ago';
  return `Updated ${days} days ago`;
}
