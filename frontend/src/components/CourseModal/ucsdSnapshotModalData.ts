import type {
  CoursePlanningCourse,
  CoursePlanningListing,
  CoursePlanningMeeting,
  CoursePlanningPastGrade,
  CoursePlanningSection,
} from '../../queries/coursePlanningViewModels';
import {
  buildFa26SectionMapping,
  fall2026Term,
  type Fa26SectionMapping,
} from '../../queries/fa26SectionMapping';
import { seatsColor, type SeatsStatus } from '../../utilities/catalogView';

export { formatSnapshotStalenessLabel } from '../../utilities/catalogFreshness';

export type UcsdModalListing = CoursePlanningListing;

export type UcsdModalSection = CoursePlanningSection & {
  listing: UcsdModalListing;
};

export type UcsdModalOfferingGroup = {
  familyPrefix: string;
  sections: UcsdModalSection[];
  sharedMeetings: CoursePlanningMeeting[];
  totalEnrolled: number;
  totalCapacity: number;
};

export type UcsdSnapshotModalCourse = {
  listings: UcsdModalListing[];
  groups: UcsdModalOfferingGroup[];
  activeFamily: string;
  selectedSectionCode: string | null;
  sectionMapping: Fa26SectionMapping;
};

export type UcsdAvailabilityStatus = SeatsStatus | 'full';

export type UcsdAvailabilityDisplay = {
  main: string;
  detail: string;
  status: UcsdAvailabilityStatus;
};

export type TssCourseDetailGroup = {
  title: string;
  items: { text: string; depth: number }[];
};

export function tssCourseDetailGroups(
  course: CoursePlanningCourse,
): TssCourseDetailGroup[] {
  const groups: TssCourseDetailGroup[] = [];
  if (course.deliveryMode) {
    groups.push({
      title: 'Delivery Mode',
      items: [{ text: course.deliveryMode, depth: 0 }],
    });
  }
  if (course.departmentNotes?.length) {
    groups.push({
      title: 'Department Notes',
      items: course.departmentNotes.map((text) => ({ text, depth: 0 })),
    });
  }
  if (course.courseNotes?.length) {
    groups.push({
      title: 'Course Notes',
      items: course.courseNotes.map((text) => ({ text, depth: 0 })),
    });
  }
  if (course.enrollmentRequirements?.length) {
    const requirementsById = new Map(
      course.enrollmentRequirements.map((requirement) => [
        requirement.id,
        requirement,
      ]),
    );
    groups.push({
      title: 'Enrollment Requirements',
      items: course.enrollmentRequirements.map((requirement) => {
        let depth = 0;
        let { parentId } = requirement;
        const seen = new Set([requirement.id]);
        while (parentId && !seen.has(parentId)) {
          seen.add(parentId);
          const parent = requirementsById.get(parentId);
          if (!parent) break;
          depth += 1;
          ({ parentId } = parent);
        }
        return { text: requirement.text, depth };
      }),
    });
  }
  return groups;
}

export function shouldShowUcsdSectionSelector(
  offeringGroups: readonly UcsdModalOfferingGroup[],
): boolean {
  return offeringGroups.length > 1;
}

export function getUcsdModalSectionFamily(
  sectionCode: string | null | undefined,
): string {
  if (!sectionCode) return '';
  const [first] = sectionCode;
  if (first && /[A-Za-z]/u.test(first)) return first.toUpperCase();
  return sectionCode;
}

function toModalSection(listing: UcsdModalListing): UcsdModalSection {
  return {
    ...listing.section,
    listing,
  };
}

function sameCourse(a: UcsdModalListing, b: UcsdModalListing): boolean {
  return (
    a.section.supportedTerm === b.section.supportedTerm &&
    a.course.courseId === b.course.courseId
  );
}

function sectionSortValue(listing: UcsdModalListing): string {
  return listing.section.sectionCode ?? '';
}

function meetingKey(meeting: CoursePlanningMeeting): string {
  return [
    meeting.meetingType ?? '',
    meeting.date ?? '',
    meeting.rawDays ?? meeting.days.join(','),
    meeting.startTime ?? '',
    meeting.endTime ?? '',
    meeting.rawLocation ?? '',
    meeting.building ?? '',
    meeting.room ?? '',
  ].join('|');
}

function findSharedMeetings(
  sections: UcsdModalSection[],
): CoursePlanningMeeting[] {
  if (sections.length <= 1) return [];
  return sections[0]!.meetings.filter((meeting) => {
    const key = meetingKey(meeting);
    return sections
      .slice(1)
      .every((section) =>
        section.meetings.some((candidate) => meetingKey(candidate) === key),
      );
  });
}

function buildOfferingGroups(
  sections: UcsdModalSection[],
): UcsdModalOfferingGroup[] {
  const families = new Map<string, UcsdModalSection[]>();
  for (const section of sections) {
    const family =
      section.supportedTerm === fall2026Term
        ? section.sectionId
        : getUcsdModalSectionFamily(section.sectionCode);
    const familySections = families.get(family);
    if (familySections) familySections.push(section);
    else families.set(family, [section]);
  }
  return [...families].map(([familyPrefix, familySections]) => ({
    familyPrefix,
    sections: familySections,
    sharedMeetings: findSharedMeetings(familySections),
    totalEnrolled: familySections.reduce(
      (total, section) =>
        section.availability.capacityKind === 'effectively_unbounded'
          ? total
          : total + (section.availability.enrolled ?? 0),
      0,
    ),
    totalCapacity: familySections.reduce(
      (total, section) =>
        section.availability.capacityKind === 'effectively_unbounded'
          ? total
          : total + (section.availability.capacity ?? 0),
      0,
    ),
  }));
}

export function buildUcsdSnapshotModalCourse(
  currentListing: UcsdModalListing,
  allListings: readonly UcsdModalListing[] = [],
): UcsdSnapshotModalCourse {
  const bySection = new Map<string, UcsdModalListing>();
  for (const listing of [currentListing, ...allListings]) {
    if (!sameCourse(currentListing, listing)) continue;
    bySection.set(listing.section.sectionId, listing);
  }

  const listings = [...bySection.values()].sort((a, b) =>
    sectionSortValue(a).localeCompare(sectionSortValue(b), 'en-US', {
      numeric: true,
      sensitivity: 'base',
    }),
  );
  const sections = listings.map(toModalSection);
  const groups = buildOfferingGroups(sections).sort((a, b) =>
    a.familyPrefix.localeCompare(b.familyPrefix),
  );
  const selectedSectionCode = currentListing.section.sectionCode;
  const activeFamily =
    (currentListing.section.supportedTerm === fall2026Term
      ? currentListing.section.sectionId
      : getUcsdModalSectionFamily(selectedSectionCode)) ||
    groups[0]?.familyPrefix ||
    '';

  return {
    listings,
    groups,
    activeFamily,
    selectedSectionCode,
    sectionMapping: buildFa26SectionMapping(sections),
  };
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
  waitlistCount: number | null = null,
  availableSeats: number | null = null,
  capacityKind: 'bounded' | 'effectively_unbounded' | null = null,
): UcsdAvailabilityDisplay {
  if (capacityKind === 'effectively_unbounded') {
    return {
      main: 'Open · no fixed cap',
      detail: '',
      status: 'available',
    };
  }
  if (availableSeats !== null) {
    if (availableSeats === 0) {
      return {
        main:
          waitlistCount !== null && waitlistCount > 0
            ? `FULL · WL(${waitlistCount})`
            : 'FULL',
        detail: '',
        status: 'full',
      };
    }
    return {
      main: `${availableSeats} ${availableSeats === 1 ? 'seat' : 'seats'} left`,
      detail: '',
      status: seatsColor(enrolled, capacity, availableSeats),
    };
  }
  if (enrolled === null || capacity === null || capacity <= 0) {
    return {
      main: 'Seats TBA',
      detail: '',
      status: 'available',
    };
  }

  if (enrolled >= capacity) {
    return {
      main:
        waitlistCount !== null && waitlistCount > 0
          ? `FULL · WL(${waitlistCount})`
          : 'FULL',
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

type UcsdGradeArchiveRecord = CoursePlanningPastGrade;

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
  records: CoursePlanningPastGrade[],
): CoursePlanningPastGrade[] {
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
