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
  buildSupportedTermRegistry,
  readSupportedTermRegistry,
  supportedTermSnapshotPath,
  writeSupportedTermRegistry,
} from './supportedTermRegistry';
import {
  buildTssCatalogSnapshot,
  parseTssRequestedSubjects,
  type TssCatalogSnapshotSources,
} from './tssSchedule';

const tssIdentitySchema = z.object({
  term: z.string().min(1),
  requested_course: z.string().min(1).optional(),
  courses: z.array(
    z.object({
      tss_course_code: z.string().min(1),
    }),
  ),
});

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

async function readJsonFiles(directory: string): Promise<unknown[]> {
  const fileNames = await jsonFileNames(directory);
  return Promise.all(
    fileNames.map(async (fileName) => {
      const contents = await readFile(path.join(directory, fileName), 'utf-8');
      return JSON.parse(contents) as unknown;
    }),
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

function tssSubjects(responses: unknown[]): string[] {
  return responses.flatMap((response) => {
    const parsed = tssIdentitySchema.parse(response);
    return [
      ...parseTssRequestedSubjects(parsed.requested_course),
      ...parsed.courses.map((course) =>
        course.tss_course_code.split('-', 1)[0]!.trim().toUpperCase(),
      ),
    ];
  });
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
};

export type TssPublishedSnapshotPipelineResult = {
  snapshot: CatalogSnapshot;
  snapshotPath: string;
  metadataPath: string | null;
};

/** Reads raw TSS files and normalized metadata, then publishes one artifact. */
export async function runTssPublishedSnapshotPipeline(
  options: TssPublishedSnapshotPipelineOptions,
): Promise<TssPublishedSnapshotPipelineResult> {
  const responses = await readJsonFiles(options.rawDirectory);
  if (responses.length === 0)
    throw new Error(`No TSS JSON files found in ${options.rawDirectory}`);

  const generalCatalogDirectory = path.join(
    options.metadataDirectory,
    'general_catalog',
  );
  const gradeArchiveDirectory = path.join(
    options.metadataDirectory,
    'instructor_grade_archive',
  );
  const generalCatalogFileNames = await jsonFileNames(generalCatalogDirectory);
  const generalCatalogCourses = (
    await readJsonFiles(generalCatalogDirectory)
  ).flat() as GeneralCatalogCourse[];
  const gradeArchiveRecords = (
    await readJsonFiles(gradeArchiveDirectory)
  ).flat() as GradeArchiveRecord[];
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
  const currentEntry = {
    term,
    label: config.term_label,
    date_range: config.term_date_range,
    frozen: false,
    generated_at: snapshot.generated_at,
    snapshot_path: supportedTermSnapshotPath(term),
    manifest_path: null,
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
  };
}
