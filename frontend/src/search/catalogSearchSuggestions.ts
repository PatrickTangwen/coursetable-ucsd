import { catalogSearchColumns, type CatalogSearchColumn } from './searchTypes';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { formatTime } from '../utilities/catalogView';
import { toSeasonString } from '../utilities/course';
import { getSubjectFullName } from '../utilities/subjectLabels';

export type { CatalogSearchColumn } from './searchTypes';

export type CatalogSearchSuggestion = {
  column: CatalogSearchColumn;
  label: string;
  value: string;
};

type CatalogSearchSuggestionIndexEntry = {
  suggestion: CatalogSearchSuggestion;
  normalizedLabel: string;
  normalizedValue: string;
  numericLabelParts: string[];
};

export type CatalogSearchSuggestionIndex =
  readonly CatalogSearchSuggestionIndexEntry[];

export function mergeCatalogSearchSuggestionIndexes(
  indexes: readonly CatalogSearchSuggestionIndex[],
): CatalogSearchSuggestionIndex {
  if (indexes.length === 0) return [];
  if (indexes.length === 1) return indexes[0]!;

  const unique = new Map<string, CatalogSearchSuggestionIndexEntry>();
  for (const index of indexes) {
    for (const entry of index) {
      const key = `${entry.suggestion.column}:${entry.normalizedLabel}`;
      if (!unique.has(key)) unique.set(key, entry);
    }
  }
  return [...unique.values()].sort(compareIndexEntries);
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

const suggestionCollator = new Intl.Collator(undefined, { numeric: true });

// Index entries are kept sorted by column rank, then label. Query-time
// ranking only reorders by match quality, so it can stay a stable O(n)
// bucket pass over an unbounded result set.
function compareIndexEntries(
  a: CatalogSearchSuggestionIndexEntry,
  b: CatalogSearchSuggestionIndexEntry,
) {
  return (
    catalogSearchColumns.indexOf(a.suggestion.column) -
      catalogSearchColumns.indexOf(b.suggestion.column) ||
    suggestionCollator.compare(a.suggestion.label, b.suggestion.label)
  );
}

function textMatchesQuery(
  entry: CatalogSearchSuggestionIndexEntry,
  tokens: string[],
) {
  return tokens.every((token) =>
    /^\d+$/u.test(token)
      ? entry.numericLabelParts.includes(token)
      : entry.normalizedLabel.includes(token),
  );
}

function meetingLabel(
  meeting: CoursePlanningListing['section']['meetings'][number],
) {
  if (meeting.isTba) return 'TBA';
  const days = meeting.rawDays ?? meeting.days.join(' ');
  const time = formatTime(meeting.startTime, meeting.endTime);
  return [days, time].filter(Boolean).join(' · ');
}

function locationLabel(
  meeting: CoursePlanningListing['section']['meetings'][number],
) {
  return (
    [meeting.building, meeting.room].filter(Boolean).join(' ') ||
    meeting.rawLocation ||
    (meeting.isTba ? 'TBA' : '')
  );
}

export function catalogSearchValues(listing: CoursePlanningListing): string[] {
  const { course, section } = listing;
  const subjectName = getSubjectFullName(course.subject);
  const termLabel = toSeasonString(section.supportedTerm as Season);

  return [
    course.subject,
    subjectName ?? '',
    course.courseCode,
    course.courseNumber,
    section.sectionCode ?? '',
    course.title,
    section.supportedTerm,
    termLabel,
    ...section.instructors.map(({ name }) => name),
    ...section.meetings.flatMap((meeting) => [
      meetingLabel(meeting),
      meeting.rawDays ?? '',
      meeting.rawTime ?? '',
      locationLabel(meeting),
      meeting.rawLocation ?? '',
    ]),
  ].filter(Boolean);
}

function suggestionsForListing(
  listing: CoursePlanningListing,
): CatalogSearchSuggestion[] {
  const { course, section } = listing;
  const subjectName = getSubjectFullName(course.subject);
  const termLabel = toSeasonString(section.supportedTerm as Season);

  return [
    {
      column: 'Subject',
      label: subjectName
        ? `${course.subject} / ${subjectName}`
        : course.subject,
      value: course.subject,
    },
    { column: 'Code', label: course.courseCode, value: course.courseCode },
    ...(section.sectionCode
      ? [
          {
            column: 'Section' as const,
            label: section.sectionCode,
            value: section.sectionCode,
          },
        ]
      : []),
    { column: 'Title', label: course.title, value: course.title },
    {
      column: 'Term',
      label: `${section.supportedTerm} / ${termLabel}`,
      value: section.supportedTerm,
    },
    ...section.instructors.map(({ name }) => ({
      column: 'Instructor' as const,
      label: name,
      value: name,
    })),
    ...section.meetings.flatMap((meeting) => {
      const meets = meetingLabel(meeting);
      const location = locationLabel(meeting);
      return [
        ...(meets
          ? [{ column: 'Meets' as const, label: meets, value: meets }]
          : []),
        ...(location
          ? [
              {
                column: 'Location' as const,
                label: location,
                value: location,
              },
            ]
          : []),
      ];
    }),
  ];
}

export function matchesCatalogSearchSuggestion(
  listing: CoursePlanningListing,
  suggestion: Pick<CatalogSearchSuggestion, 'column' | 'value'>,
) {
  const expected = normalized(suggestion.value);
  const { course, section } = listing;

  switch (suggestion.column) {
    case 'Subject':
      return normalized(course.subject) === expected;
    case 'Code':
      return normalized(course.courseCode) === expected;
    case 'Section':
      return normalized(section.sectionCode ?? '') === expected;
    case 'Title':
      return normalized(course.title) === expected;
    case 'Term':
      return normalized(section.supportedTerm) === expected;
    case 'Instructor':
      return section.instructors.some(
        ({ name }) => normalized(name) === expected,
      );
    case 'Meets':
      return section.meetings.some(
        (meeting) => normalized(meetingLabel(meeting)) === expected,
      );
    case 'Location':
      return section.meetings.some(
        (meeting) => normalized(locationLabel(meeting)) === expected,
      );
    default:
      return false;
  }
}

function suggestionScore(
  entry: CatalogSearchSuggestionIndexEntry,
  query: string,
) {
  const { suggestion, normalizedValue: value } = entry;
  const prefixScore = value === query ? 0 : value.startsWith(query) ? 1 : 2;
  return catalogSearchColumns.indexOf(suggestion.column) * 10 + prefixScore;
}

export function createCatalogSearchSuggestionIndex(
  listings: CoursePlanningListing[],
): CatalogSearchSuggestionIndex {
  const unique = new Map<string, CatalogSearchSuggestionIndexEntry>();
  for (const listing of listings) {
    for (const suggestion of suggestionsForListing(listing)) {
      const normalizedLabel = normalized(suggestion.label);
      const key = `${suggestion.column}:${normalizedLabel}`;
      if (unique.has(key)) continue;
      unique.set(key, {
        suggestion,
        normalizedLabel,
        normalizedValue: normalized(suggestion.value),
        numericLabelParts: normalizedLabel.match(/\d+/gu) ?? [],
      });
    }
  }

  return [...unique.values()].sort(compareIndexEntries);
}

/**
 * Every matching suggestion, ranked by column, then match quality (exact /
 * prefix / contains), then label. The caller virtualizes the rendered list,
 * so the result is intentionally unbounded.
 */
export function searchCatalogSearchSuggestions(
  index: CatalogSearchSuggestionIndex,
  query: string,
): CatalogSearchSuggestion[] {
  const needle = normalized(query);
  if (!needle) return [];
  const tokens = needle.split(/\s+/u);
  const buckets: CatalogSearchSuggestion[][] = [];
  for (const entry of index) {
    if (!textMatchesQuery(entry, tokens)) continue;
    const score = suggestionScore(entry, needle);
    (buckets[score] ??= []).push(entry.suggestion);
  }
  return buckets.flat();
}
