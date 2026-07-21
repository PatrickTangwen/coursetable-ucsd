import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import {
  publishCatalogSnapshot,
  type CatalogSnapshot,
  type CatalogSnapshotConfig,
} from './catalogSnapshot';
import type { GeneralCatalogCourse } from './generalCatalog';
import type { GradeArchiveRecord } from './instructorGradeArchive';
import {
  buildPublishedSnapshotImportManifest,
  publishedSnapshotImportManifestPath,
  type ImportManifestCell,
  type PublishedSnapshotImportManifest,
} from './publishedSnapshotPipeline';
import { createFileSnapshotStorage } from './snapshotStorage';
import {
  buildSupportedTermRegistry,
  readSupportedTermRegistry,
  supportedTermManifestPath,
  supportedTermSnapshotPath,
  writeSupportedTermRegistry,
} from './supportedTermRegistry';
import {
  applyTssAvailabilitySupplement,
  parseTssAvailabilitySupplement,
} from './tssAvailabilitySupplement';
import {
  buildTssCatalogSnapshot,
  parseTssRequestedSubjects,
  type TssCatalogSnapshotSources,
} from './tssSchedule';

const tssIdentitySchema = z.object({
  term: z.string().min(1),
  requested_course: z.string().min(1).optional(),
  coverage: z.object({
    complete: z.boolean(),
    continuation_needed: z.boolean(),
    omitted_courses: z.array(z.string().min(1)).optional(),
  }),
  courses: z.array(
    z.object({
      tss_course_code: z.string().min(1),
    }),
  ),
});

type NamedJsonFile = { fileName: string; value: unknown };

type ScheduleManifestOptions = {
  term: string;
  subjects: string[];
  snapshot: CatalogSnapshot;
  rawDirectory: string;
  namedResponses: NamedJsonFile[];
  availabilitySupplementPath: string | null;
  availabilitySupplementSubjects: Set<string>;
};

type NormalizedManifestOptions<T> = {
  term: string;
  subjects: string[];
  source: 'general_catalog' | 'instructor_grade_archive';
  directory: string;
  valuesBySubject: Map<string, T[]>;
  rowCountName: 'courses' | 'records';
};

const termNames: { [prefix: string]: string } = {
  FA: 'Fall',
  S1: 'Summer Session 1',
  S2: 'Summer Session 2',
  S3: 'Summer Session 3',
  SP: 'Spring',
  SU: 'Summer',
  WI: 'Winter',
};

function termLabel(term: string): string {
  const match = /^(?<prefix>WI|SP|S1|S2|S3|SU|FA)(?<year>\d{2})$/u.exec(term);
  const prefix = match?.groups?.prefix;
  const year = match?.groups?.year;
  return prefix && year ? `${termNames[prefix] ?? prefix} 20${year}` : term;
}

async function jsonFileNames(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

async function readNamedJsonFiles(directory: string) {
  const fileNames = await jsonFileNames(directory);
  return Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      value: JSON.parse(
        await readFile(path.join(directory, fileName), 'utf-8'),
      ) as unknown,
    })),
  );
}

function tssTerm(responses: unknown[]): string {
  const terms = new Set(
    responses.map((response) => tssIdentitySchema.parse(response).term),
  );
  if (terms.size !== 1)
    throw new Error('TSS responses must contain exactly one term');
  return terms.values().next().value!;
}

function tssResponseSubjects(response: unknown): string[] {
  const parsed = tssIdentitySchema.parse(response);
  return [
    ...parseTssRequestedSubjects(parsed.requested_course),
    ...parsed.courses.map((course) =>
      course.tss_course_code.split('-', 1)[0]!.trim().toUpperCase(),
    ),
  ];
}

function tssSubjects(responses: unknown[]): string[] {
  return responses.flatMap(tssResponseSubjects);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export type TssPublishedSnapshotPipelineOptions = {
  config: CatalogSnapshotConfig;
  rawDirectory: string;
  metadataDirectory: string;
  metadataSourceTimestamp: string;
  runId?: string;
  generatedAt?: string;
  availabilitySupplementPath?: string;
};

export type TssPublishedSnapshotPipelineResult = {
  snapshot: CatalogSnapshot;
  snapshotPath: string;
  metadataPath: string | null;
  manifest: PublishedSnapshotImportManifest;
  manifestPath: string;
  availabilitySupplement: {
    path: string;
    records: number;
    matchedRecords: number;
    updatedComponents: number;
    overriddenValues: number;
    unmatchedRecords: number;
    unmatchedKeys: string[];
  } | null;
};

async function optionalTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function isCompleteTssResponse(response: unknown): boolean {
  const { coverage } = tssIdentitySchema.parse(response);
  return (
    coverage.complete &&
    !coverage.continuation_needed &&
    (coverage.omitted_courses?.length ?? 0) === 0
  );
}

function scheduleRowCounts(snapshot: CatalogSnapshot, subject: string) {
  const courses = snapshot.courses.filter(
    (course) => course.subject === subject,
  );
  const sections = courses.flatMap((course) => course.sections);
  return {
    courses: courses.length,
    sections: sections.length,
    meetings: sections.reduce(
      (count, section) => count + section.meetings.length,
      0,
    ),
  };
}

function scheduleCellState(
  matchingResponses: { value: unknown }[],
  hasRows: boolean,
): Pick<ImportManifestCell, 'status' | 'reason'> {
  if (matchingResponses.length === 0)
    return { status: 'failed', reason: 'no TSS response covers subject' };
  if (matchingResponses.some(({ value }) => !isCompleteTssResponse(value))) {
    return {
      status: 'partial',
      reason:
        'batch-level TSS response reports incomplete coverage; subject completeness is unknown',
    };
  }
  if (!hasRows) {
    return {
      status: 'empty',
      reason: 'no TSS schedule rows for subject in term',
    };
  }
  return { status: 'ok', reason: null };
}

function scheduleManifestCells(
  options: ScheduleManifestOptions,
): ImportManifestCell[] {
  return options.subjects.map((subject) => {
    const matchingResponses = options.namedResponses.filter(({ value }) =>
      tssResponseSubjects(value).includes(subject),
    );
    const rowCounts = scheduleRowCounts(options.snapshot, subject);
    const hasRows = Object.values(rowCounts).some((count) => count > 0);
    const rawArtifacts = matchingResponses.map(({ fileName }) =>
      path.join(options.rawDirectory, fileName),
    );
    if (
      matchingResponses.length &&
      options.availabilitySupplementPath &&
      options.availabilitySupplementSubjects.has(subject)
    )
      rawArtifacts.push(options.availabilitySupplementPath);

    const { status, reason } = scheduleCellState(matchingResponses, hasRows);

    return {
      term: options.term,
      subject,
      source: 'schedule_of_classes',
      status,
      reason,
      attempts: matchingResponses.length ? 1 : 0,
      row_counts: rowCounts,
      raw_artifacts: rawArtifacts,
      normalized_artifact: null,
    };
  });
}

function normalizedManifestCells<T>(
  options: NormalizedManifestOptions<T>,
): ImportManifestCell[] {
  return options.subjects.map((subject) => {
    const values = options.valuesBySubject.get(subject);
    const artifactPath = path.join(options.directory, `${subject}.json`);
    const status =
      values === undefined ? 'failed' : values.length ? 'ok' : 'empty';
    return {
      term: options.term,
      subject,
      source: options.source,
      status,
      reason:
        values === undefined
          ? 'normalized metadata artifact is missing'
          : values.length
            ? null
            : `no ${options.source === 'general_catalog' ? 'General Catalog rows' : 'Instructor Grade Archive rows'} for subject`,
      attempts: values === undefined ? 0 : 1,
      row_counts: { [options.rowCountName]: values?.length ?? 0 },
      raw_artifacts: [],
      normalized_artifact: values === undefined ? null : artifactPath,
    };
  });
}

/** Reads raw TSS files and normalized metadata, then publishes one artifact. */
export async function runTssPublishedSnapshotPipeline(
  options: TssPublishedSnapshotPipelineOptions,
): Promise<TssPublishedSnapshotPipelineResult> {
  const namedResponses = await readNamedJsonFiles(options.rawDirectory);
  let responses = namedResponses.map(({ value }) => value);
  if (responses.length === 0)
    throw new Error(`No TSS JSON files found in ${options.rawDirectory}`);
  const availabilitySupplementPath =
    options.availabilitySupplementPath ??
    path.join(options.rawDirectory, 'capacity_enrollment_supp.txt');
  const availabilitySupplementContents = await optionalTextFile(
    availabilitySupplementPath,
  );
  const availabilitySupplementRecords = availabilitySupplementContents
    ? parseTssAvailabilitySupplement(availabilitySupplementContents)
    : null;
  const availabilitySupplement =
    availabilitySupplementRecords !== null
      ? applyTssAvailabilitySupplement(responses, availabilitySupplementRecords)
      : null;
  if (availabilitySupplement) ({ responses } = availabilitySupplement);

  const generalCatalogDirectory = path.join(
    options.metadataDirectory,
    'general_catalog',
  );
  const gradeArchiveDirectory = path.join(
    options.metadataDirectory,
    'instructor_grade_archive',
  );
  const generalCatalogFileNames = await jsonFileNames(generalCatalogDirectory);
  const generalCatalogValues = await readNamedJsonFiles(
    generalCatalogDirectory,
  );
  const gradeArchiveValues = await readNamedJsonFiles(gradeArchiveDirectory);
  const generalCatalogBySubject = new Map(
    generalCatalogValues.map(({ fileName, value }) => [
      path.basename(fileName, '.json').toUpperCase(),
      value as GeneralCatalogCourse[],
    ]),
  );
  const gradeArchiveBySubject = new Map(
    gradeArchiveValues.map(({ fileName, value }) => [
      path.basename(fileName, '.json').toUpperCase(),
      value as GradeArchiveRecord[],
    ]),
  );
  const generalCatalogCourses = [...generalCatalogBySubject.values()].flat();
  const gradeArchiveRecords = [...gradeArchiveBySubject.values()].flat();
  const term = tssTerm(responses);
  const configuredSubjects = uniqueSorted([
    ...options.config.configured_subjects,
    ...generalCatalogFileNames.map((fileName) =>
      path.basename(fileName, '.json').toUpperCase(),
    ),
    ...tssSubjects(responses),
  ]);
  const config: CatalogSnapshotConfig = {
    ...options.config,
    active_planning_term: term,
    term_label: termLabel(term),
    term_date_range: options.config.term_date_ranges?.[term] ?? null,
    configured_subjects: configuredSubjects,
  };
  const metadataSources: Pick<
    TssCatalogSnapshotSources,
    'generalCatalog' | 'gradeArchive'
  > = {
    generalCatalog: {
      sourceTimestamp: options.metadataSourceTimestamp,
      courses: generalCatalogCourses,
    },
    gradeArchive: {
      sourceTimestamp: options.metadataSourceTimestamp,
      records: gradeArchiveRecords,
    },
  };
  const snapshot = buildTssCatalogSnapshot(config, responses, {
    ...metadataSources,
    runId: options.runId,
    generatedAt: options.generatedAt,
  });
  const published = await publishCatalogSnapshot(snapshot, config, {
    writeMetadata: false,
  });
  const manifest = buildPublishedSnapshotImportManifest({
    config,
    runId: snapshot.run_id,
    generatedAt: snapshot.generated_at,
    systemicParserFailureThreshold: 0.5,
    cells: [
      ...scheduleManifestCells({
        term,
        subjects: configuredSubjects,
        snapshot,
        rawDirectory: options.rawDirectory,
        namedResponses,
        availabilitySupplementPath: availabilitySupplement
          ? availabilitySupplementPath
          : null,
        availabilitySupplementSubjects: new Set(
          availabilitySupplementRecords?.map(({ subject }) => subject) ?? [],
        ),
      }),
      ...normalizedManifestCells({
        term,
        subjects: configuredSubjects,
        source: 'general_catalog',
        directory: generalCatalogDirectory,
        valuesBySubject: generalCatalogBySubject,
        rowCountName: 'courses',
      }),
      ...normalizedManifestCells({
        term,
        subjects: configuredSubjects,
        source: 'instructor_grade_archive',
        directory: gradeArchiveDirectory,
        valuesBySubject: gradeArchiveBySubject,
        rowCountName: 'records',
      }),
    ],
  });
  const manifestPath = await createFileSnapshotStorage().writeJson(
    publishedSnapshotImportManifestPath(config),
    manifest,
  );
  const currentEntry = {
    term,
    label: config.term_label,
    date_range: config.term_date_range,
    frozen: false,
    generated_at: snapshot.generated_at,
    snapshot_path: supportedTermSnapshotPath(term),
    manifest_path: supportedTermManifestPath(term),
  };
  const existingRegistry = await readSupportedTermRegistry(
    config.paths.metadata_path,
  );
  const preservedEntries = (existingRegistry?.terms ?? []).filter(
    (entry) => entry.term !== term,
  );
  const registry = buildSupportedTermRegistry(
    [currentEntry, ...preservedEntries],
    snapshot.generated_at,
  );
  const metadataPath = await writeSupportedTermRegistry(
    registry,
    config.paths.metadata_path,
  );
  return {
    snapshot,
    snapshotPath: published.snapshotPath,
    metadataPath,
    manifest,
    manifestPath,
    availabilitySupplement: availabilitySupplement
      ? {
          path: availabilitySupplementPath,
          records: availabilitySupplement.records,
          matchedRecords: availabilitySupplement.matchedRecords,
          updatedComponents: availabilitySupplement.updatedComponents,
          overriddenValues: availabilitySupplement.overriddenValues,
          unmatchedRecords: availabilitySupplement.unmatchedRecords,
          unmatchedKeys: availabilitySupplement.unmatchedKeys,
        }
      : null,
  };
}
