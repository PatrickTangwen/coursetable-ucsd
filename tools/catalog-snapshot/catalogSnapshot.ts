import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import pathModule from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { GeneralCatalogCourse } from './generalCatalog';
import type { GradeArchiveRecord } from './instructorGradeArchive';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const termCodeSchema = z
  .string()
  .min(1)
  .regex(/^[\w-]+$/u);

export const catalogSnapshotConfigSchema = z
  .object({
    active_planning_term: termCodeSchema,
    term_label: z.string().min(1),
    term_date_range: z
      .object({
        start: dateSchema,
        end: dateSchema,
      })
      .strict(),
    configured_subjects: z.array(z.string().min(1)).min(1),
    paths: z
      .object({
        raw_dir: z.string().min(1),
        normalized_dir: z.string().min(1),
        reports_dir: z.string().min(1),
        public_catalog_dir: z.string().min(1),
        metadata_path: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const sourceTimestampsSchema = z
  .object({
    schedule_of_classes: z.string().nullable(),
    general_catalog: z.string().nullable(),
    instructor_grade_archive: z.string().nullable(),
  })
  .strict();

const gradeArchiveRecordSchema = z
  .object({
    subject: z.string(),
    course: z.string(),
    year: z.string(),
    quarter: z.string(),
    title: z.string().nullable(),
    instructor: z.string().nullable(),
    gpa: z.number().nullable(),
    a: z.number().nullable(),
    b: z.number().nullable(),
    c: z.number().nullable(),
    d: z.number().nullable(),
    f: z.number().nullable(),
    w: z.number().nullable(),
    p: z.number().nullable(),
    np: z.number().nullable(),
    raw: z.record(z.string()),
  })
  .strict();

const meetingSchema = z
  .object({
    days: z.array(z.string()),
    start_time: z.string().nullable(),
    end_time: z.string().nullable(),
    building: z.string().nullable(),
    room: z.string().nullable(),
    is_tba: z.boolean(),
    raw_days: z.string().nullable(),
    raw_time: z.string().nullable(),
    raw_location: z.string().nullable(),
  })
  .strict();

const sectionSchema = z
  .object({
    section_id: z.string().min(1),
    course_id: z.string().min(1),
    section_code: z.string().nullable(),
    meeting_type: z.string().nullable(),
    instructors: z.array(z.string()),
    meetings: z.array(meetingSchema),
    raw: z.record(z.unknown()),
  })
  .strict();

const courseSchema = z
  .object({
    course_id: z.string().min(1),
    subject: z.string().min(1),
    course_number: z.string().min(1),
    title: z.string().min(1),
    units: z.string().nullable(),
    description: z.string().nullable(),
    prerequisites_text: z.string().nullable(),
    restrictions_text: z.string().nullable(),
    catalog_url: z.string().nullable(),
    archive_avg_gpa: z.number().nullable(),
    archive_record_count: z.number().int().nonnegative(),
    grade_archive_records: z.array(gradeArchiveRecordSchema),
    ge_matches: z.array(z.never()),
    sections: z.array(sectionSchema),
  })
  .strict();

export const catalogSnapshotSchema = z
  .object({
    run_id: z.string().min(1),
    generated_at: z.string().min(1),
    active_planning_term: termCodeSchema,
    term_label: z.string().min(1),
    term_date_range: z
      .object({
        start: dateSchema,
        end: dateSchema,
      })
      .strict(),
    configured_subjects: z.array(z.string().min(1)).min(1),
    source_timestamps: sourceTimestampsSchema,
    courses: z.array(courseSchema),
  })
  .strict();

export type CatalogSnapshotConfig = z.infer<typeof catalogSnapshotConfigSchema>;
export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;

export type CatalogSnapshotMetadata = {
  last_update: string;
  run_id: string;
  generated_at: string;
  active_planning_term: string;
  term_label: string;
  term_date_range: CatalogSnapshot['term_date_range'];
  configured_subjects: string[];
  source_timestamps: CatalogSnapshot['source_timestamps'];
  published_snapshot: string;
};

export type ValidationResult = {
  success: boolean;
  errors: string[];
};

export async function loadCatalogSnapshotConfig(
  configPath: string,
): Promise<CatalogSnapshotConfig> {
  const rawConfig = parse(await readFile(configPath, 'utf-8')) as unknown;
  const parsed = catalogSnapshotConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(
      `Catalog Snapshot config is invalid:\n${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}

const excludedPublicKeys = new Set([
  'capacity',
  'cape',
  'demand',
  'enrollment',
  'eval',
  'evals',
  'evaluation',
  'evaluations',
  'friend_count',
  'friend_ids',
  'friends',
  'open_seats',
  'professor_rating',
  'rating',
  'seats_available',
  'seats_limit',
  'set',
  'waitlist',
  'workload',
]);

function collectExcludedFieldPaths(value: unknown, fieldPath = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectExcludedFieldPaths(item, `${fieldPath}[${index}]`),
    );
  }
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => {
    const currentPath = `${fieldPath}.${key}`;
    const normalizedKey = key.toLowerCase();
    const ownErrors = excludedPublicKeys.has(normalizedKey)
      ? [`excluded field ${currentPath}`]
      : [];
    return ownErrors.concat(collectExcludedFieldPaths(child, currentPath));
  });
}

function validateConfiguredSubjects(
  snapshot: CatalogSnapshot,
  config: CatalogSnapshotConfig,
): string[] {
  const configured = new Set(config.configured_subjects);
  const subjectsInSnapshot = new Set(
    snapshot.courses.map((course) => course.subject),
  );
  const errors: string[] = [];

  for (const subject of configured) {
    if (!subjectsInSnapshot.has(subject))
      errors.push(`missing configured subject ${subject}`);
  }

  for (const subject of subjectsInSnapshot)
    if (!configured.has(subject)) errors.push(`unexpected subject ${subject}`);

  return errors;
}

function validateSectionIds(
  snapshot: CatalogSnapshot,
  config: CatalogSnapshotConfig,
): string[] {
  return snapshot.courses.flatMap((course, courseIndex) =>
    course.sections.flatMap((section, sectionIndex) => {
      if (section.section_id.startsWith(`${config.active_planning_term}:`))
        return [];
      return [
        `courses[${courseIndex}].sections[${sectionIndex}].section_id must start with ${config.active_planning_term}:`,
      ];
    }),
  );
}

export function validateCatalogSnapshot(
  value: unknown,
  config: CatalogSnapshotConfig,
): ValidationResult {
  const parsedConfig = catalogSnapshotConfigSchema.safeParse(config);
  if (!parsedConfig.success) {
    return {
      success: false,
      errors: parsedConfig.error.issues.map((issue) => issue.message),
    };
  }

  const parsedSnapshot = catalogSnapshotSchema.safeParse(value);
  if (!parsedSnapshot.success) {
    return {
      success: false,
      errors: parsedSnapshot.error.issues.map((issue) => issue.message),
    };
  }

  const snapshot = parsedSnapshot.data;
  const errors = [
    ...(snapshot.active_planning_term === config.active_planning_term
      ? []
      : ['snapshot active planning term does not match config']),
    ...(snapshot.term_label === config.term_label
      ? []
      : ['snapshot term label does not match config']),
    ...validateConfiguredSubjects(snapshot, config),
    ...validateSectionIds(snapshot, config),
    ...collectExcludedFieldPaths(snapshot),
  ];

  return {
    success: errors.length === 0,
    errors,
  };
}

export function buildTracerCatalogSnapshot(
  config: CatalogSnapshotConfig,
  options: {
    runId?: string;
    generatedAt?: string;
    generalCatalogCourses?: GeneralCatalogCourse[];
  } = {},
): CatalogSnapshot {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const runId = options.runId ?? `tracer-${generatedAt}`;
  const generalCatalogCourseBySubject = new Map<string, GeneralCatalogCourse>();
  for (const course of options.generalCatalogCourses ?? []) {
    if (generalCatalogCourseBySubject.has(course.subject)) continue;
    generalCatalogCourseBySubject.set(course.subject, course);
  }

  return {
    run_id: runId,
    generated_at: generatedAt,
    active_planning_term: config.active_planning_term,
    term_label: config.term_label,
    term_date_range: config.term_date_range,
    configured_subjects: config.configured_subjects,
    source_timestamps: {
      schedule_of_classes: null,
      general_catalog: null,
      instructor_grade_archive: null,
    },
    courses: config.configured_subjects.map((subject) => {
      const generalCatalogCourse = generalCatalogCourseBySubject.get(subject);
      const courseNumber = generalCatalogCourse?.course_number ?? '1';
      const courseId =
        generalCatalogCourse?.course_id ?? `${subject}:${courseNumber}`;
      const sectionSuffix = generalCatalogCourse ? courseNumber : '001';
      return {
        course_id: courseId,
        subject,
        course_number: courseNumber,
        title: generalCatalogCourse?.title ?? `${subject} Tracer Course`,
        units: generalCatalogCourse?.units ?? null,
        description:
          generalCatalogCourse?.description ?? `Tracer course for ${subject}.`,
        prerequisites_text: generalCatalogCourse?.prerequisites_text ?? null,
        restrictions_text: generalCatalogCourse?.restrictions_text ?? null,
        catalog_url: generalCatalogCourse?.catalog_url ?? null,
        archive_avg_gpa: null,
        archive_record_count: 0,
        grade_archive_records: [],
        ge_matches: [],
        sections: [
          {
            section_id: `${config.active_planning_term}:${subject}-TRACER-${sectionSuffix}`,
            course_id: courseId,
            section_code: 'A00',
            meeting_type: 'Lecture',
            instructors: [],
            meetings: [
              {
                days: [],
                start_time: null,
                end_time: null,
                building: null,
                room: null,
                is_tba: true,
                raw_days: null,
                raw_time: 'TBA',
                raw_location: null,
              },
            ],
            raw: {
              source: 'tracer',
            },
          },
        ],
      };
    }),
  };
}

function gradeArchiveCourseId(record: GradeArchiveRecord): string {
  return `${record.subject.trim().toUpperCase()}:${record.course
    .trim()
    .toUpperCase()
    .replace(/\s+/gu, '')}`;
}

function meanGpa(records: GradeArchiveRecord[]): number | null {
  const gpas = records
    .map((record) => record.gpa)
    .filter((gpa): gpa is number => gpa !== null);
  if (!gpas.length) return null;
  return gpas.reduce((sum, gpa) => sum + gpa, 0) / gpas.length;
}

export function attachGradeArchiveRecords(
  snapshot: CatalogSnapshot,
  records: GradeArchiveRecord[],
): CatalogSnapshot {
  const recordsByCourseId = new Map<string, GradeArchiveRecord[]>();
  for (const record of records) {
    const courseId = gradeArchiveCourseId(record);
    const courseRecords = recordsByCourseId.get(courseId) ?? [];
    courseRecords.push(record);
    recordsByCourseId.set(courseId, courseRecords);
  }
  return {
    ...snapshot,
    courses: snapshot.courses.map((course) => {
      const gradeArchiveRecords = recordsByCourseId.get(course.course_id) ?? [];
      return {
        ...course,
        archive_avg_gpa: meanGpa(gradeArchiveRecords),
        archive_record_count: gradeArchiveRecords.length,
        grade_archive_records: gradeArchiveRecords,
      };
    }),
  };
}

export function attachGeneralCatalogMetadata(
  snapshot: CatalogSnapshot,
  catalogCourses: GeneralCatalogCourse[],
): CatalogSnapshot {
  const coursesByCourseId = new Map(
    catalogCourses.map((course) => [course.course_id, course]),
  );
  return {
    ...snapshot,
    courses: snapshot.courses.map((course) => {
      const catalogCourse = coursesByCourseId.get(course.course_id);
      if (!catalogCourse) return course;
      return {
        ...course,
        title: catalogCourse.title,
        units: catalogCourse.units,
        description: catalogCourse.description,
        prerequisites_text: catalogCourse.prerequisites_text,
        restrictions_text: catalogCourse.restrictions_text,
        catalog_url: catalogCourse.catalog_url,
      };
    }),
  };
}

export function buildCatalogSnapshotMetadata(
  snapshot: CatalogSnapshot,
): CatalogSnapshotMetadata {
  return {
    last_update: snapshot.generated_at,
    run_id: snapshot.run_id,
    generated_at: snapshot.generated_at,
    active_planning_term: snapshot.active_planning_term,
    term_label: snapshot.term_label,
    term_date_range: snapshot.term_date_range,
    configured_subjects: snapshot.configured_subjects,
    source_timestamps: snapshot.source_timestamps,
    published_snapshot: `catalogs/public/${snapshot.active_planning_term}.json`,
  };
}

function writeJson(pathname: string, value: unknown) {
  return writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export async function publishCatalogSnapshot(
  snapshot: CatalogSnapshot,
  config: CatalogSnapshotConfig,
): Promise<{ snapshotPath: string; metadataPath: string }> {
  const validation = validateCatalogSnapshot(snapshot, config);
  if (!validation.success) {
    throw new Error(
      `Catalog Snapshot validation failed:\n${validation.errors.join('\n')}`,
    );
  }

  const snapshotPath = pathModule.join(
    config.paths.public_catalog_dir,
    `${snapshot.active_planning_term}.json`,
  );
  const metadataPath = config.paths.metadata_path;
  const metadata = buildCatalogSnapshotMetadata(snapshot);
  const tempSuffix = `.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  const tempSnapshotPath = `${snapshotPath}${tempSuffix}`;
  const tempMetadataPath = `${metadataPath}${tempSuffix}`;

  await mkdir(config.paths.public_catalog_dir, { recursive: true });
  await mkdir(pathModule.dirname(metadataPath), { recursive: true });

  try {
    await writeJson(tempSnapshotPath, snapshot);
    await writeJson(tempMetadataPath, metadata);
    await rename(tempSnapshotPath, snapshotPath);
    await rename(tempMetadataPath, metadataPath);
  } catch (err) {
    await Promise.all([
      rm(tempSnapshotPath, { force: true }),
      rm(tempMetadataPath, { force: true }),
    ]);
    throw err;
  }

  return { snapshotPath, metadataPath };
}
