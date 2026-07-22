import { tssLocationDisplay } from '../../shared/tssMeetingDays.js';

const expectedHeader = [
  'term_code',
  'subject_code',
  'course_code',
  'class_name',
  'course_title',
  'academic_level',
  'section_id',
  'section_ref',
  'section_code',
  'instruction_type_name',
  'instructors_text',
  'seats_available',
  'waitlist_available',
  'meeting_kind',
  'day_code',
  'day_name',
  'specific_date',
  'start_time_display',
  'end_time_display',
  'building_code',
  'room_code',
  'is_remote',
  'is_tba',
] as const;

type Column = (typeof expectedHeader)[number];
type CsvRow = { [column in Column]: string } & {
  chunk: number;
  line: number;
};

export type TritonGptCsvConversionOptions = {
  capturedAt: string;
  expectedSubjects?: string[];
  stablePackageIds?: { [packageIdentity: string]: string };
};

const naturalCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});

function sourceIdentifier(value: string) {
  return value.trim().replace(/\s+/gu, '');
}

export function tritonGptPackageIdentity(
  tssCourseCode: string,
  eventIds: string[],
) {
  return `${sourceIdentifier(tssCourseCode)}:${eventIds
    .map(sourceIdentifier)
    .sort(naturalCollator.compare)
    .join('+')}`;
}

const sectionTypeBySuffix: { [key: string]: string } = {
  CL: 'cl',
  CO: 'co',
  DI: 'discussion',
  FW: 'fw',
  IN: 'in',
  IT: 'it',
  LA: 'lab',
  LE: 'lecture',
  OT: 'ot',
  PR: 'pr',
  SE: 'se',
  ST: 'studio',
  TU: 'tu',
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort(naturalCollator.compare);
}

function parseInteger(value: string) {
  if (!value) return null;
  if (!/^\d+$/u.test(value))
    throw new Error(`Expected an integer, got ${value}`);
  return Number(value);
}

function academicLevelIndex(tokens: string[]) {
  return tokens.findIndex(
    (token, index) =>
      index >= 4 &&
      ['LD', 'UD', 'GR'].includes(token) &&
      /^(?:E\s+\d+|EL\d+)$/u.test(tokens[index + 1] ?? ''),
  );
}

function parseLine(line: string, chunk: number, lineNumber: number): CsvRow {
  const tokens = line.split(',');
  const levelIndex = academicLevelIndex(tokens);
  const meetingIndex = tokens.length - 10;
  if (
    levelIndex < 4 ||
    meetingIndex < levelIndex + 5 ||
    !['0', '1'].includes(tokens.at(-2) ?? '') ||
    !['0', '1'].includes(tokens.at(-1) ?? '')
  ) {
    throw new Error(
      'row is truncated or does not contain the fixed meeting tail',
    );
  }

  const middle = tokens.slice(levelIndex + 5, meetingIndex);
  let instructors = '';
  let seats = '';
  let waitlist = '';
  if (middle.length >= 3) {
    instructors = middle.slice(0, -2).join(',');
    seats = middle.at(-2) ?? '';
    waitlist = middle.at(-1) ?? '';
  } else if (middle.length === 2) {
    seats = middle[0] ?? '';
    waitlist = middle[1] ?? '';
  } else if (middle.length === 1) {
    instructors = middle[0] ?? '';
  } else {
    throw new Error('row has no instructor or availability fields');
  }

  const values = [
    ...tokens.slice(0, 4),
    tokens.slice(4, levelIndex).join(','),
    ...tokens.slice(levelIndex, levelIndex + 5),
    instructors,
    seats,
    waitlist,
    ...tokens.slice(meetingIndex),
  ];
  if (values.length !== expectedHeader.length)
    throw new Error(`row expanded to ${values.length} columns`);
  return Object.assign(
    Object.fromEntries(
      expectedHeader.map((name, index) => [name, values[index] ?? '']),
    ),
    {
      chunk,
      line: lineNumber,
    },
  ) as unknown as CsvRow;
}

function rowKey(row: CsvRow, columns: readonly Column[] = expectedHeader) {
  return columns.map((column) => row[column]).join('\u001f');
}

function stableValue(rows: CsvRow[], column: Column) {
  const values = [...new Set(rows.map((row) => row[column]))].sort(
    naturalCollator.compare,
  );
  if (values.length !== 1) {
    throw new Error(
      `${rows[0]?.section_ref ?? 'section'} has conflicting ${column}: ${values.join(', ')}`,
    );
  }
  return values[0]!;
}

function optionalStableValue(rows: CsvRow[], column: Column) {
  const values = uniqueSorted(rows.map((row) => row[column]));
  if (values.length > 1) {
    throw new Error(
      `${rows[0]?.section_ref ?? 'section'} has conflicting ${column}: ${values.join(', ')}`,
    );
  }
  return values[0] ?? '';
}

function instructionType(row: CsvRow) {
  if (row.instruction_type_name) return row.instruction_type_name;
  const suffix = row.section_code.split('-').at(-1)?.toUpperCase() ?? '';
  return sectionTypeBySuffix[suffix] ?? 'other';
}

function location(row: CsvRow) {
  return tssLocationDisplay(
    row.building_code,
    row.room_code,
    row.is_remote === '1',
  );
}

function toMeeting(row: CsvRow) {
  return {
    meeting_kind: row.meeting_kind,
    specific_date: row.specific_date || null,
    days: row.day_code || null,
    start_time: row.start_time_display || null,
    end_time: row.end_time_display || null,
    location_displayed: location(row),
    building: row.building_code || null,
    room: row.room_code || null,
    instructor: row.instructors_text || null,
    is_remote: row.is_remote === '1',
    is_tba: row.is_tba === '1',
    is_arranged: null,
  };
}

function sectionKey(row: CsvRow) {
  return [
    row.term_code,
    row.subject_code,
    row.course_code,
    row.section_ref,
  ].join('\u001f');
}

function courseKey(row: CsvRow) {
  return [row.subject_code, row.course_code].join('\u001f');
}

function sectionCoordinates(sectionCode: string) {
  const match = /^(?<classGroup>\d+)-(?<choiceGroup>\d+)-[A-Z]+$/u.exec(
    sectionCode,
  );
  const classGroup = match?.groups?.classGroup;
  const choiceGroup = match?.groups?.choiceGroup;
  if (!classGroup || !choiceGroup)
    throw new Error(`Unexpected TSS section code: ${sectionCode}`);
  return { classGroup, choiceGroup };
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const group = groups.get(key(value));
    if (group) group.push(value);
    else groups.set(key(value), [value]);
  }
  return groups;
}

function parseChunks(chunks: string[]) {
  const rows: CsvRow[] = [];
  const malformedRows: {
    chunk: number;
    line: number;
    reason: string;
    raw: string;
  }[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const lines = chunk.replace(/\r\n/gu, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (lines[0] !== expectedHeader.join(','))
      throw new Error(`Chunk ${chunkIndex + 1} has an unexpected CSV header`);
    for (const [lineIndex, line] of lines.slice(1).entries()) {
      try {
        rows.push(parseLine(line, chunkIndex + 1, lineIndex + 2));
      } catch (error) {
        malformedRows.push({
          chunk: chunkIndex + 1,
          line: lineIndex + 2,
          reason: error instanceof Error ? error.message : String(error),
          raw: line,
        });
      }
    }
  }
  return { rows, malformedRows };
}

function deduplicateRows(rows: CsvRow[]) {
  const unique = new Map(rows.map((row) => [rowKey(row), row]));
  return {
    rows: [...unique.values()],
    duplicatesRemoved: rows.length - unique.size,
  };
}

function toComponent(sectionRows: CsvRow[]) {
  for (const column of [
    'term_code',
    'subject_code',
    'course_code',
    'course_title',
    'academic_level',
    'section_id',
    'section_ref',
    'section_code',
    'instructors_text',
  ] as const)
    stableValue(sectionRows, column);
  const seats = optionalStableValue(sectionRows, 'seats_available');
  const waitlist = optionalStableValue(sectionRows, 'waitlist_available');
  const meetingColumns = expectedHeader.filter(
    (column) =>
      ![
        'seats_available',
        'waitlist_available',
        'term_code',
        'subject_code',
        'course_code',
        'class_name',
        'course_title',
        'academic_level',
        'section_id',
        'section_ref',
        'section_code',
        'instruction_type_name',
        'instructors_text',
      ].includes(column),
  );
  const meetings = [
    ...new Map(
      sectionRows.map((row) => [rowKey(row, meetingColumns), row]),
    ).values(),
  ].map(toMeeting);
  return {
    type: instructionType(sectionRows[0]!),
    section_code: sectionRows[0]!.section_code,
    event_id: sectionRows[0]!.section_id,
    requirement: 'required',
    meetings,
    enrollment: {
      enrolled: null,
      capacity: null,
      seats_available: parseInteger(seats),
      waitlist: {
        state: waitlist ? 'available_spots' : 'not_shown',
        count: null,
        available_spots: parseInteger(waitlist),
      },
    },
  };
}

function toCourse(
  rows: CsvRow[],
  stablePackageIds: { [packageIdentity: string]: string },
) {
  const first = rows[0]!;
  const components = [...groupBy(rows, sectionKey).values()]
    .sort((a, b) =>
      naturalCollator.compare(a[0]!.section_code, b[0]!.section_code),
    )
    .map(toComponent);
  const componentGroups = groupBy(
    components,
    (component) => sectionCoordinates(component.section_code).classGroup,
  );
  const packages = [...componentGroups.values()].flatMap((classComponents) => {
    const choiceGroups = groupBy(
      classComponents,
      (component) => sectionCoordinates(component.section_code).choiceGroup,
    );
    const sharedComponents = choiceGroups.get('000') ?? [];
    const alternatives = [...choiceGroups.entries()]
      .filter(([choiceGroup]) => choiceGroup !== '000')
      .sort(([a], [b]) => naturalCollator.compare(a, b))
      .map(([, choiceComponents]) => choiceComponents);
    if (alternatives.length > 0) {
      return alternatives.map((choiceComponents) => [
        ...sharedComponents,
        ...choiceComponents,
      ]);
    }
    if (sharedComponents.length > 0) return [sharedComponents];
    return [...choiceGroups.values()];
  });
  const tssCourseCode = `${first.subject_code}-${first.course_code}`;
  const bookingChoices = packages.map((packageComponents, index) => {
    const stablePackageId =
      stablePackageIds[
        tritonGptPackageIdentity(
          tssCourseCode,
          packageComponents.map((component) => component.event_id),
        )
      ];
    return {
      booking_choice_ordinal: index + 1,
      displayed_package_section: null,
      displayed_package_id:
        stablePackageId ??
        (packageComponents.length === 1
          ? packageComponents[0]!.event_id
          : null),
      components: packageComponents,
    };
  });
  return {
    course_code: first.course_code,
    course_title: stableValue(rows, 'course_title'),
    tss_course_code: tssCourseCode,
    booking_choices: bookingChoices,
  };
}

export function convertTritonGptCsvChunks(
  chunks: string[],
  options: TritonGptCsvConversionOptions,
) {
  if (chunks.length === 0) throw new Error('No TritonGPT CSV chunks supplied');
  const parsed = parseChunks(chunks);
  const deduplicated = deduplicateRows(parsed.rows);
  const { rows } = deduplicated;
  const terms = uniqueSorted(rows.map((row) => row.term_code));
  if (terms.length !== 1)
    throw new Error(`Expected one term, got ${terms.join(', ')}`);
  const subjects = uniqueSorted(rows.map((row) => row.subject_code));
  const expectedSubjects = uniqueSorted(options.expectedSubjects ?? subjects);
  const subjectsWithoutRows = expectedSubjects.filter(
    (subject) => !subjects.includes(subject),
  );
  const omittedCourses = uniqueSorted(
    parsed.malformedRows.map(
      ({ raw }) => raw.split(',').slice(0, 4).at(-1) ?? '',
    ),
  );
  const complete =
    parsed.malformedRows.length === 0 && subjectsWithoutRows.length === 0;
  const courses = [...groupBy(rows, courseKey).values()]
    .map((courseRows) => toCourse(courseRows, options.stablePackageIds ?? {}))
    .sort((a, b) =>
      naturalCollator.compare(a.tss_course_code, b.tss_course_code),
    );
  const response = {
    schema_version: 'tss-chatbot-v1',
    term: terms[0]!,
    requested_course: expectedSubjects.join(', '),
    source_metadata: {
      last_refreshed_displayed: null,
      captured_at: options.capturedAt,
      availability_observed_at: options.capturedAt,
    },
    coverage: {
      complete,
      continuation_needed: !complete,
      ...(omittedCourses.length ? { omitted_courses: omittedCourses } : {}),
    },
    courses,
  };
  const report = {
    chunks: chunks.length,
    raw_rows: parsed.rows.length,
    exact_duplicates_removed: deduplicated.duplicatesRemoved,
    converted_rows: rows.length,
    malformed_rows: parsed.malformedRows,
    subjects,
    expected_subjects_without_rows: subjectsWithoutRows,
    courses: courses.length,
    sections: courses.reduce(
      (count, course) => count + course.booking_choices.length,
      0,
    ),
    coverage: response.coverage,
  };
  return { response, report };
}
