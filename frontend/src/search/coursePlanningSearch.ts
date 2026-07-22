import { catalogSearchValues } from './catalogSearchSuggestions';
import { defaultFilters } from './searchConstants';
import type { Filters, SortKeys } from './searchTypes';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import { isEqual } from '../utilities/common';
import { subjects } from '../utilities/constants';

export type CoursePlanningSearchContext = {
  friendCount?: (listing: CoursePlanningListing) => number;
  isConflicting?: (listing: CoursePlanningListing) => boolean;
  quistPredicate?: (listing: CoursePlanningListing) => boolean;
};

function legacySearchCreditValue(units: string | null): number | null {
  if (!units) return null;
  const match = /\d+(?:\.\d+)?/u.exec(units);
  return match ? Number(match[0]) : null;
}

// Persisted numBounds and Quist queries encode the inherited CourseTable
// number scale. Keep that external behavior until a separate search-contract
// migration can update stored URLs and saved searches together.
function legacySearchCourseNumberValue(number: string): number {
  const digits = number.replace(/\D/gu, '');
  const value = Number(digits);
  return digits.length === 3 ? value * 10 : value;
}

function meetingDayValue(day: string): number | null {
  const normalized = day.toLowerCase();
  if (normalized.startsWith('sun')) return 0;
  if (normalized.startsWith('mon')) return 1;
  if (normalized.startsWith('tu')) return 2;
  if (normalized.startsWith('we')) return 3;
  if (normalized.startsWith('th')) return 4;
  if (normalized.startsWith('fr')) return 5;
  if (normalized.startsWith('sa')) return 6;
  return null;
}

function rangeTime(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 12 + (minute ?? 0) / 5;
}

function isDiscussion(listing: CoursePlanningListing): boolean {
  return /^[A-Z]*$/u.test(listing.section.sectionCode ?? '');
}

function isGraduate(listing: CoursePlanningListing): boolean {
  // The persisted filter means "not Yale undergraduate school", so every UCSD
  // listing matched before this transport refactor. Preserve that contract.
  return listing.course.subject.length > 0;
}

function attributeValues(
  listing: CoursePlanningListing,
): ('discussion' | 'graduate' | 'fysem' | 'colsem' | 'sysem')[] {
  const values: ('discussion' | 'graduate')[] = [];
  if (isGraduate(listing)) values.push('graduate');
  if (isDiscussion(listing)) values.push('discussion');
  return values;
}

function matchesSearchText(
  listing: CoursePlanningListing,
  tokens: string[],
  searchDescription: boolean,
): boolean {
  const { course, section } = listing;
  const first = course.courseNumber.charAt(0);
  const catalogValues = catalogSearchValues(listing).map((value) =>
    value.toLowerCase(),
  );
  const matchesLegacySearch = tokens.every(
    (token) =>
      course.courseCode.toLowerCase().startsWith(token) ||
      course.subject.toLowerCase().startsWith(token) ||
      course.courseNumber.toLowerCase().startsWith(token) ||
      (/\D/u.test(first) &&
        course.courseNumber
          .toLowerCase()
          .startsWith(first.toLowerCase() + token)) ||
      (searchDescription &&
        Boolean(course.description?.toLowerCase().includes(token))) ||
      course.title.toLowerCase().includes(token) ||
      Boolean(subjects[course.subject]?.toLowerCase().includes(token)) ||
      section.instructors.some(({ name }) =>
        name.toLowerCase().includes(token),
      ) ||
      section.meetings.some(({ building }) =>
        building?.toLowerCase().startsWith(token),
      ),
  );
  const matchesOneCatalogValue = catalogValues.some((value) =>
    tokens.every((token) =>
      /^\d+$/u.test(token)
        ? (value.match(/\d+/gu)?.includes(token) ?? false)
        : value.includes(token),
    ),
  );
  return matchesLegacySearch || matchesOneCatalogValue;
}

function applySelectedValues<T>(
  selected: T[],
  values: T[],
  intersecting: boolean,
): boolean {
  if (selected.length === 0) return true;
  return intersecting
    ? selected.every((value) => values.includes(value))
    : selected.some((value) => values.includes(value));
}

function matchesExactDays(selectedDays: number[], meetingDays: number[]) {
  if (selectedDays.length === 0) return true;
  const selected = new Set(selectedDays);
  const actual = new Set(meetingDays);
  return (
    selected.size === actual.size &&
    [...selected].every((day) => actual.has(day))
  );
}

function listingLocation(listing: CoursePlanningListing): string {
  return listing.section.meetings
    .map(({ building, room }) => [building, room].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ');
}

function firstMeetingScore(listing: CoursePlanningListing): number | null {
  const meeting = listing.section.meetings.find(
    ({ startTime }) => startTime !== null,
  );
  if (!meeting?.startTime) return null;
  const days = meeting.days
    .map(meetingDayValue)
    .filter((day): day is number => day !== null);
  const firstDay = Math.min(...days);
  if (!Number.isFinite(firstDay)) return null;
  return firstDay * 10000 + Number(meeting.startTime.replace(':', ''));
}

function comparableValue(
  listing: CoursePlanningListing,
  key: SortKeys | 'term' | 'section',
  context: CoursePlanningSearchContext,
): string | number | Date | null {
  switch (key) {
    case 'course_code':
      return listing.course.courseCode;
    case 'title':
      return listing.course.title;
    case 'friend':
      return context.friendCount?.(listing) ?? 0;
    case 'added':
      return new Date(listing.generatedAt);
    case 'last_modified':
      return new Date(
        listing.section.availability.snapshotTimestamp ?? listing.generatedAt,
      );
    case 'time':
      return firstMeetingScore(listing);
    case 'location':
      return listingLocation(listing);
    case 'overall':
      return listing.evaluation.overallRating;
    case 'average_professor_rating':
      return listing.evaluation.professorRating;
    case 'workload':
      return listing.evaluation.workload;
    case 'average_gut_rating':
      return listing.evaluation.gutRating;
    case 'enrollment':
      return listing.evaluation.enrollment;
    case 'term':
      return listing.section.supportedTerm;
    case 'section':
      return listing.section.sectionCode;
    default:
      return null;
  }
}

function compareValues(
  a: string | number | Date | null,
  b: string | number | Date | null,
  order: 'asc' | 'desc',
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const direction = order === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number')
    return (a - b) * direction;
  if (a instanceof Date && b instanceof Date)
    return (a.getTime() - b.getTime()) * direction;
  return (
    String(a).localeCompare(String(b), 'en-US', { numeric: true }) * direction
  );
}

function compareListings(
  a: CoursePlanningListing,
  b: CoursePlanningListing,
  filters: Filters,
  context: CoursePlanningSearchContext,
): number {
  return (
    compareValues(
      comparableValue(a, filters.selectSortBy.value, context),
      comparableValue(b, filters.selectSortBy.value, context),
      filters.sortOrder,
    ) ||
    compareValues(
      comparableValue(a, 'term', context),
      comparableValue(b, 'term', context),
      'desc',
    ) ||
    compareValues(
      comparableValue(a, 'course_code', context),
      comparableValue(b, 'course_code', context),
      'asc',
    ) ||
    compareValues(
      comparableValue(a, 'section', context),
      comparableValue(b, 'section', context),
      'asc',
    )
  );
}

function isWithinTimeBounds(
  listing: CoursePlanningListing,
  [min, max]: [number, number],
): boolean {
  return listing.section.meetings.some(
    ({ startTime, endTime }) =>
      startTime !== null &&
      endTime !== null &&
      rangeTime(startTime) >= min &&
      rangeTime(endTime) <= max,
  );
}

export function coursePlanningQueryValue(
  listing: CoursePlanningListing,
  key: string,
  isConflicting: (candidate: CoursePlanningListing) => boolean,
): unknown {
  const { course, section } = listing;
  switch (key) {
    case 'added':
      return listing.generatedAt;
    case 'last_modified':
      return section.availability.snapshotTimestamp ?? listing.generatedAt;
    case 'rating':
      return listing.evaluation.overallRating;
    case 'workload':
      return listing.evaluation.workload;
    case 'professor-rating':
      return listing.evaluation.professorRating;
    case 'enrollment':
      return listing.evaluation.enrollment;
    case 'days':
      return section.meetings.flatMap(({ days }) => days);
    case 'info-attributes':
    case 'skills':
    case 'areas':
      return [];
    case 'subjects':
    case 'listings.subjects':
      return [course.subject];
    case 'listings.course-codes':
      return [course.courseCode];
    case 'listings.schools':
      return ['UCSD'];
    case 'cancelled':
      return false;
    case 'conflicting':
      return isConflicting(listing);
    case 'grad':
      return isGraduate(listing);
    case 'discussion':
      return isDiscussion(listing);
    case 'fysem':
    case 'colsem':
      return false;
    case 'location':
      return listingLocation(listing);
    case 'season':
      return section.supportedTerm;
    case 'professor-names':
      return section.instructors.length > 0
        ? section.instructors.map(({ name }) => name)
        : ['TBA'];
    case 'building-codes':
      return section.meetings.flatMap(({ building }) =>
        building ? [building] : [],
      );
    case 'course-code':
      return course.courseCode;
    case 'type':
      return 'lecture';
    case 'number':
      return legacySearchCourseNumberValue(course.courseNumber);
    case 'subject':
      return course.subject;
    case 'school':
      return 'UCSD';
    case 'title':
      return course.title;
    case 'description':
      return course.description;
    case 'credits':
      return legacySearchCreditValue(course.units);
    case '*':
      return `${course.courseCode} ${course.subject} ${course.courseNumber} ${course.title} ${section.instructors.map(({ name }) => name).join(' ')}`;
    default:
      return null;
  }
}

export function filterAndSortCoursePlanningListings(
  listings: CoursePlanningListing[],
  filters: Filters,
  context: CoursePlanningSearchContext = {},
): CoursePlanningListing[] {
  const tokens = filters.searchText
    .split(/\s+/u)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  const subjectsSelected = filters.selectSubjects.map(({ value }) => value);
  const daysSelected = filters.selectDays.map(({ value }) => value);
  const buildingsSelected = filters.selectBuilding.map(({ value }) => value);
  const creditsSelected = filters.selectCredits.map(({ value }) => value);
  const schoolsSelected = filters.selectSchools.map(({ value }) => value);
  const courseNumbers = filters.numBounds;
  const filtered = listings.filter((listing) => {
    const { course, section } = listing;
    const { evaluation } = listing;
    const ratingBounds: [number | null, [number, number], [number, number]][] =
      [
        [
          evaluation.overallRating,
          filters.overallBounds,
          defaultFilters.overallBounds,
        ],
        [
          evaluation.workload,
          filters.workloadBounds,
          defaultFilters.workloadBounds,
        ],
        [
          evaluation.professorRating,
          filters.professorBounds,
          defaultFilters.professorBounds,
        ],
        [
          evaluation.enrollment,
          filters.enrollBounds,
          defaultFilters.enrollBounds,
        ],
      ];
    for (const [value, bounds, defaults] of ratingBounds) {
      if (isEqual(bounds, defaults)) continue;
      if (value === null) return false;
      const rounded = Math.round(value * 10) / 10;
      if (rounded < bounds[0] || rounded > bounds[1]) return false;
    }
    if (
      !isEqual(filters.timeBounds, defaultFilters.timeBounds) &&
      !isWithinTimeBounds(listing, filters.timeBounds)
    )
      return false;
    const number = legacySearchCourseNumberValue(course.courseNumber);
    if (
      number < courseNumbers[0] ||
      (courseNumbers[1] < 10000 && number > courseNumbers[1])
    )
      return false;
    if (
      context.isConflicting &&
      filters.hideConflicting &&
      context.isConflicting(listing)
    )
      return false;
    if (
      !applySelectedValues(
        subjectsSelected,
        [course.subject],
        filters.intersectingFilters.includes('selectSubjects'),
      )
    )
      return false;
    const days = section.meetings
      .filter(({ meetingType }) => meetingType?.toLowerCase() !== 'final')
      .flatMap(({ days: meetingDays }) => meetingDays.map(meetingDayValue))
      .filter((day): day is number => day !== null);
    if (!matchesExactDays(daysSelected, days)) return false;
    if (filters.selectSkillsAreas.length > 0) return false;
    const credits = legacySearchCreditValue(course.units);
    if (
      creditsSelected.length > 0 &&
      credits !== null &&
      !creditsSelected.includes(credits)
    )
      return false;
    if (
      !applySelectedValues(
        buildingsSelected,
        section.meetings.flatMap(({ building }) =>
          building ? [building] : [],
        ),
        false,
      )
    )
      return false;
    if (filters.selectCourseInfoAttributes.length > 0) return false;
    if (!applySelectedValues(schoolsSelected, ['UCSD'], false)) return false;
    const attributes = attributeValues(listing);
    if (
      filters.includeAttributes.length > 0 &&
      !filters.includeAttributes.some((attribute) =>
        attributes.includes(attribute),
      )
    )
      return false;
    if (
      filters.excludeAttributes.some((attribute) =>
        attributes.includes(attribute),
      )
    )
      return false;
    if (context.quistPredicate) return context.quistPredicate(listing);
    return matchesSearchText(listing, tokens, filters.searchDescription);
  });

  return filtered.toSorted((a, b) => compareListings(a, b, filters, context));
}
