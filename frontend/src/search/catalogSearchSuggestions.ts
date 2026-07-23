import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { formatTime } from '../utilities/catalogView';
import { toSeasonString } from '../utilities/course';
import { getSubjectFullName } from '../utilities/subjectLabels';

export type CatalogSearchColumn =
  | 'Subject'
  | 'Code'
  | 'Section'
  | 'Title'
  | 'Term'
  | 'Instructor'
  | 'Meets'
  | 'Location';

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

const columnOrder: CatalogSearchColumn[] = [
  'Subject',
  'Code',
  'Section',
  'Title',
  'Term',
  'Instructor',
  'Meets',
  'Location',
];

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
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
  return columnOrder.indexOf(suggestion.column) * 10 + prefixScore;
}

function compareSuggestions(
  a: CatalogSearchSuggestionIndexEntry,
  b: CatalogSearchSuggestionIndexEntry,
  query: string,
) {
  const score = suggestionScore(a, query) - suggestionScore(b, query);
  return (
    score ||
    a.suggestion.label.localeCompare(b.suggestion.label, undefined, {
      numeric: true,
    })
  );
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

  return [...unique.values()];
}

export function searchCatalogSearchSuggestions(
  index: CatalogSearchSuggestionIndex,
  query: string,
  limit = 8,
): CatalogSearchSuggestion[] {
  const needle = normalized(query);
  if (!needle) return [];
  const tokens = needle.split(/\s+/u);
  const best: CatalogSearchSuggestionIndexEntry[] = [];
  for (const entry of index) {
    if (!textMatchesQuery(entry, tokens)) continue;
    const insertAt = best.findIndex(
      (candidate) => compareSuggestions(entry, candidate, needle) < 0,
    );
    if (insertAt < 0) {
      if (best.length < limit) best.push(entry);
      continue;
    }
    best.splice(insertAt, 0, entry);
    if (best.length > limit) best.pop();
  }
  return best.map(({ suggestion }) => suggestion);
}
