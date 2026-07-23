import {
  catalogSearchValues,
  createCatalogSearchSuggestionIndex,
  matchesCatalogSearchSuggestion,
  mergeCatalogSearchSuggestionIndexes,
  type CatalogSearchSuggestion,
  type CatalogSearchSuggestionIndex,
} from './catalogSearchSuggestions';
import { catalogUnitValues } from './catalogUnits';
import { defaultFilters } from './searchConstants';
import type { Filters } from './searchTypes';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { isEqual } from '../utilities/common';
import { subjects } from '../utilities/constants';

export type CoursePlanningSearchContext = {
  catalogSearchSelection?: CatalogSearchSuggestion | null;
  isConflicting?: (listing: CoursePlanningListing) => boolean;
  quistPredicate?: (listing: CoursePlanningListing) => boolean;
};

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

type IndexedCatalogSearchValue = {
  readonly text: string;
  readonly numericParts: readonly string[];
};

type CoursePlanningSearchRecord = {
  readonly listing: CoursePlanningListing;
  readonly prefixSearchValues: readonly string[];
  readonly containsSearchValues: readonly string[];
  readonly description: string;
  readonly catalogValues: readonly IndexedCatalogSearchValue[];
  readonly courseNumberValue: number;
  readonly meetingDays: readonly number[];
  readonly unitValues: readonly number[];
  readonly buildingCodes: readonly string[];
  readonly attributes: ReturnType<typeof attributeValues>;
};

export type CoursePlanningSearchIndex = {
  readonly records: readonly CoursePlanningSearchRecord[];
  readonly suggestions: CatalogSearchSuggestionIndex;
};

function createCoursePlanningSearchRecord(
  listing: CoursePlanningListing,
): CoursePlanningSearchRecord {
  const { course, section } = listing;
  const normalizedCourseNumber = course.courseNumber.toLowerCase();
  const [firstCourseNumberCharacter] = normalizedCourseNumber;
  const buildingCodes = section.meetings.flatMap(({ building }) =>
    building ? [building] : [],
  );
  const meetingDays = [
    ...new Set(
      section.meetings
        .filter(({ meetingType }) => meetingType?.toLowerCase() !== 'final')
        .flatMap(({ days }) => days.map(meetingDayValue))
        .filter((day): day is number => day !== null),
    ),
  ];
  const prefixSearchValues = [
    course.courseCode,
    course.subject,
    course.courseNumber,
    ...buildingCodes,
  ].map((value) => value.toLowerCase());
  if (firstCourseNumberCharacter && /\D/u.test(firstCourseNumberCharacter))
    prefixSearchValues.push(normalizedCourseNumber.slice(1));

  return {
    listing,
    prefixSearchValues,
    containsSearchValues: [
      course.title,
      subjects[course.subject] ?? '',
      ...section.instructors.map(({ name }) => name),
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
    description: course.description?.toLowerCase() ?? '',
    catalogValues: catalogSearchValues(listing).map((value) => {
      const text = value.toLowerCase();
      return { text, numericParts: text.match(/\d+/gu) ?? [] };
    }),
    courseNumberValue: legacySearchCourseNumberValue(course.courseNumber),
    meetingDays,
    unitValues: catalogUnitValues(course.units),
    buildingCodes,
    attributes: attributeValues(listing),
  };
}

export function createCoursePlanningSearchIndex(
  listings: CoursePlanningListing[],
): CoursePlanningSearchIndex {
  return {
    records: listings.map(createCoursePlanningSearchRecord),
    suggestions: createCatalogSearchSuggestionIndex(listings),
  };
}

function mergeCoursePlanningSearchIndexes(
  indexes: readonly CoursePlanningSearchIndex[],
): CoursePlanningSearchIndex {
  if (indexes.length === 0) return { records: [], suggestions: [] };
  if (indexes.length === 1) return indexes[0]!;
  return {
    records: indexes.flatMap(({ records }) => records),
    suggestions: mergeCatalogSearchSuggestionIndexes(
      indexes.map(({ suggestions }) => suggestions),
    ),
  };
}

export function mergeCoursePlanningSearchIndexesForSeasons(
  seasons: readonly Season[],
  indexForSeason: (season: Season) => CoursePlanningSearchIndex | undefined,
): CoursePlanningSearchIndex {
  return mergeCoursePlanningSearchIndexes(
    seasons.flatMap((season) => {
      const index = indexForSeason(season);
      return index ? [index] : [];
    }),
  );
}

function matchesSearchText(
  record: CoursePlanningSearchRecord,
  tokens: string[],
  searchDescription: boolean,
): boolean {
  if (tokens.length === 0) return true;
  const matchesLegacySearch = tokens.every(
    (token) =>
      record.prefixSearchValues.some((value) => value.startsWith(token)) ||
      record.containsSearchValues.some((value) => value.includes(token)) ||
      (searchDescription && record.description.includes(token)),
  );
  const matchesOneCatalogValue = record.catalogValues.some((value) =>
    tokens.every((token) =>
      /^\d+$/u.test(token)
        ? value.numericParts.includes(token)
        : value.text.includes(token),
    ),
  );
  return matchesLegacySearch || matchesOneCatalogValue;
}

function applySelectedValues<T>(
  selected: readonly T[],
  values: readonly T[],
  intersecting: boolean,
): boolean {
  if (selected.length === 0) return true;
  return intersecting
    ? selected.every((value) => values.includes(value))
    : selected.some((value) => values.includes(value));
}

function matchesExactDays(
  selectedDays: readonly number[],
  meetingDays: readonly number[],
) {
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
    case 'credits': {
      const [primaryUnitValue = null] = catalogUnitValues(course.units);
      return primaryUnitValue;
    }
    case '*':
      return `${course.courseCode} ${course.subject} ${course.courseNumber} ${course.title} ${section.instructors.map(({ name }) => name).join(' ')}`;
    default:
      return null;
  }
}

export function filterCoursePlanningSearchIndex(
  index: CoursePlanningSearchIndex,
  filters: Filters,
  context: CoursePlanningSearchContext = {},
): CoursePlanningListing[] {
  const tokens = filters.searchText
    .split(/\s+/u)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  const subjectsSelected = filters.selectSubjects.map(({ value }) => value);
  const daysSelected = [
    ...new Set(filters.selectDays.map(({ value }) => value)),
  ];
  const buildingsSelected = filters.selectBuilding.map(({ value }) => value);
  const creditsSelected = filters.selectCredits.map(({ value }) => value);
  const schoolsSelected = filters.selectSchools.map(({ value }) => value);
  const courseNumbers = filters.numBounds;
  const filtered = index.records.filter((record) => {
    const { listing } = record;
    const { course } = listing;
    const { evaluation } = listing;
    if (
      context.catalogSearchSelection &&
      !matchesCatalogSearchSuggestion(listing, context.catalogSearchSelection)
    )
      return false;
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
    const number = record.courseNumberValue;
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
    if (!matchesExactDays(daysSelected, record.meetingDays)) return false;
    if (filters.selectSkillsAreas.length > 0) return false;
    if (
      creditsSelected.length > 0 &&
      !record.unitValues.some((value) => creditsSelected.includes(value))
    )
      return false;
    if (!applySelectedValues(buildingsSelected, record.buildingCodes, false))
      return false;
    if (filters.selectCourseInfoAttributes.length > 0) return false;
    if (!applySelectedValues(schoolsSelected, ['UCSD'], false)) return false;
    if (
      filters.includeAttributes.length > 0 &&
      !filters.includeAttributes.some((attribute) =>
        record.attributes.includes(attribute),
      )
    )
      return false;
    if (
      filters.excludeAttributes.some((attribute) =>
        record.attributes.includes(attribute),
      )
    )
      return false;
    if (context.quistPredicate) return context.quistPredicate(listing);
    return matchesSearchText(record, tokens, filters.searchDescription);
  });

  return filtered.map(({ listing }) => listing);
}
