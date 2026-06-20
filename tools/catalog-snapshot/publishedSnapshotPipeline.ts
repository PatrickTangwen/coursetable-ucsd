import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import pathModule from 'node:path';
import {
  attachGeneralCatalogMetadata,
  attachGradeArchiveRecords,
  publishCatalogSnapshot,
  validateCatalogSnapshot,
  type CatalogSnapshot,
  type CatalogSnapshotConfig,
  type ValidationResult,
} from './catalogSnapshot';
import {
  fetchRawGeneralCatalogForSubject,
  parseGeneralCatalogHtml,
  type GeneralCatalogCourse,
} from './generalCatalog';
import {
  fetchRawInstructorGradeArchiveForSubject,
  parseInstructorGradeArchiveHtml,
  type GradeArchiveRecord,
} from './instructorGradeArchive';
import {
  buildScheduleCatalogSnapshot,
  fetchRawScheduleOfClassesForSubject,
  parseScheduleOfClassesHtml,
  type ParsedScheduleOfClasses,
} from './scheduleOfClasses';

type FetchAdapter = typeof fetch;
type SourceKind =
  | 'schedule_of_classes'
  | 'general_catalog'
  | 'instructor_grade_archive';
type PipelineStatus = 'published' | 'failed';

type RawSourceFile = {
  filename: string;
  contents: string;
};

type ParsedSource<T> = {
  source_timestamp: string | null;
  data: T;
};

type SourceLoad<T> = {
  subject: string;
  fetched_at: string;
  raw_files: RawSourceFile[];
  parse: () => ParsedSource<T> | Promise<ParsedSource<T>>;
};

type SourceLoader<T> = (
  subject: string,
  context: PublishedSnapshotSourceLoadContext,
) => SourceLoad<T> | Promise<SourceLoad<T>>;

export type PublishedSnapshotSourceLoadContext = {
  config: CatalogSnapshotConfig;
  runId: string;
  generatedAt: string;
  fetch?: FetchAdapter;
};

export type PublishedSnapshotSourceLoaders = {
  scheduleOfClasses: SourceLoader<ParsedScheduleOfClasses>;
  generalCatalog: SourceLoader<GeneralCatalogCourse[]>;
  instructorGradeArchive: SourceLoader<GradeArchiveRecord[]>;
};

type PipelineError = {
  source: SourceKind | 'publish';
  subject: string | null;
  phase: 'fetch' | 'parse' | 'write' | 'publish';
  message: string;
};

type StepResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: PipelineError;
    };

type CollectedSource<T> = {
  source: SourceKind;
  subject: string;
  fetched_at: string;
  source_timestamp: string | null;
  raw_artifacts: string[];
  normalized_artifact: string;
  data: T;
};

export type PublishedSnapshotImportReport = {
  run_id: string;
  generated_at: string;
  active_planning_term: string;
  term_label: string;
  configured_subjects: string[];
  status: PipelineStatus;
  source_timestamps: CatalogSnapshot['source_timestamps'];
  sources: {
    source: SourceKind;
    subject: string;
    fetched_at: string;
    source_timestamp: string | null;
    raw_artifacts: string[];
    normalized_artifact: string;
    row_counts: { [key: string]: number };
  }[];
  row_counts: {
    schedule_of_classes: {
      courses: number;
      sections: number;
      meetings: number;
      by_subject: {
        [key: string]: { courses: number; sections: number; meetings: number };
      };
    };
    general_catalog: {
      courses: number;
      by_subject: { [key: string]: { courses: number } };
    };
    instructor_grade_archive: {
      records: number;
      by_subject: { [key: string]: { records: number } };
    };
    catalog_snapshot: {
      courses: number;
      sections: number;
    };
  };
  validation: ValidationResult;
  errors: PipelineError[];
  parser_errors: PipelineError[];
  raw_artifacts: string[];
  normalized_artifacts: string[];
  staging_snapshot_path: string | null;
  published_snapshot_path: string | null;
  metadata_path: string | null;
};

export type PublishedSnapshotPipelineResult = {
  report: PublishedSnapshotImportReport;
  reportPath: string;
  snapshotPath: string;
  metadataPath: string;
};

type RunPaths = {
  rawRoot: string;
  normalizedRoot: string;
  reportPath: string;
};

function defaultRunId(generatedAt: string): string {
  const timestamp = generatedAt.replace(/[^\dA-Za-z]+/gu, '-');
  return `published-${timestamp}-${randomUUID()}`;
}

function safePathComponent(value: string): string {
  const normalized = value.trim().replace(/[^\w.-]+/gu, '_');
  return normalized || 'source';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function writeJson(pathname: string, value: unknown) {
  return writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function writeRawFiles(
  paths: RunPaths,
  source: SourceKind,
  files: RawSourceFile[],
): Promise<string[]> {
  const sourceDir = pathModule.join(paths.rawRoot, source);
  await mkdir(sourceDir, { recursive: true });
  const writtenPaths: string[] = [];

  for (const file of files) {
    const filename = safePathComponent(pathModule.basename(file.filename));
    const artifactPath = pathModule.join(sourceDir, filename);
    await writeFile(artifactPath, file.contents, 'utf-8');
    writtenPaths.push(artifactPath);
  }

  return writtenPaths;
}

async function writeNormalized<T>(
  paths: RunPaths,
  source: SourceKind,
  subject: string,
  data: T,
): Promise<string> {
  const sourceDir = pathModule.join(paths.normalizedRoot, source);
  await mkdir(sourceDir, { recursive: true });
  const artifactPath = pathModule.join(
    sourceDir,
    `${safePathComponent(subject)}.json`,
  );
  await writeJson(artifactPath, data);
  return artifactPath;
}

async function runStep<T>(
  errorContext: Omit<PipelineError, 'message'>,
  action: () => T | Promise<T>,
): Promise<StepResult<T>> {
  try {
    return {
      ok: true,
      value: await action(),
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        ...errorContext,
        message: errorMessage(err),
      },
    };
  }
}

async function collectSources<T>(
  source: SourceKind,
  subjects: string[],
  loader: SourceLoader<T>,
  context: PublishedSnapshotSourceLoadContext,
  paths: RunPaths,
): Promise<{
  collected: CollectedSource<T>[];
  errors: PipelineError[];
}> {
  const collected: CollectedSource<T>[] = [];
  const errors: PipelineError[] = [];

  for (const subject of subjects) {
    const sourceLoadResult = await runStep(
      { source, subject, phase: 'fetch' },
      () => loader(subject, context),
    );
    if (!sourceLoadResult.ok) {
      errors.push(sourceLoadResult.error);
      continue;
    }
    const sourceLoad = sourceLoadResult.value;

    const rawArtifactsResult = await runStep(
      { source, subject, phase: 'write' },
      () => writeRawFiles(paths, source, sourceLoad.raw_files),
    );
    if (!rawArtifactsResult.ok) {
      errors.push(rawArtifactsResult.error);
      continue;
    }
    const rawArtifacts = rawArtifactsResult.value;

    const parsedResult = await runStep(
      { source, subject, phase: 'parse' },
      sourceLoad.parse,
    );
    if (!parsedResult.ok) {
      errors.push(parsedResult.error);
      continue;
    }
    const parsed = parsedResult.value;

    const normalizedArtifactResult = await runStep(
      { source, subject, phase: 'write' },
      () => writeNormalized(paths, source, sourceLoad.subject, parsed.data),
    );
    if (!normalizedArtifactResult.ok) {
      errors.push(normalizedArtifactResult.error);
      continue;
    }

    collected.push({
      source,
      subject: sourceLoad.subject,
      fetched_at: sourceLoad.fetched_at,
      source_timestamp: parsed.source_timestamp,
      raw_artifacts: rawArtifacts,
      normalized_artifact: normalizedArtifactResult.value,
      data: parsed.data,
    });
  }

  return { collected, errors };
}

function firstTimestamp<T>(sources: CollectedSource<T>[]): string | null {
  return (
    sources.find((source) => source.source_timestamp)?.source_timestamp ??
    sources[0]?.fetched_at ??
    null
  );
}

function scheduleSubjectCounts(parsed: ParsedScheduleOfClasses) {
  const sections = parsed.courses.flatMap((course) => course.sections);
  return {
    courses: parsed.courses.length,
    sections: sections.length,
    meetings: sections.reduce(
      (count, section) => count + section.meetings.length,
      0,
    ),
  };
}

function buildScheduleRowCounts(
  sources: CollectedSource<ParsedScheduleOfClasses>[],
) {
  const bySubject: {
    [key: string]: { courses: number; sections: number; meetings: number };
  } = {};
  for (const source of sources)
    bySubject[source.subject] = scheduleSubjectCounts(source.data);

  return {
    courses: Object.values(bySubject).reduce(
      (count, subject) => count + subject.courses,
      0,
    ),
    sections: Object.values(bySubject).reduce(
      (count, subject) => count + subject.sections,
      0,
    ),
    meetings: Object.values(bySubject).reduce(
      (count, subject) => count + subject.meetings,
      0,
    ),
    by_subject: bySubject,
  };
}

function buildGeneralCatalogRowCounts(
  sources: CollectedSource<GeneralCatalogCourse[]>[],
) {
  const bySubject: { [key: string]: { courses: number } } = {};
  for (const source of sources)
    bySubject[source.subject] = { courses: source.data.length };

  return {
    courses: Object.values(bySubject).reduce(
      (count, subject) => count + subject.courses,
      0,
    ),
    by_subject: bySubject,
  };
}

function buildGradeArchiveRowCounts(
  sources: CollectedSource<GradeArchiveRecord[]>[],
) {
  const bySubject: { [key: string]: { records: number } } = {};
  for (const source of sources)
    bySubject[source.subject] = { records: source.data.length };

  return {
    records: Object.values(bySubject).reduce(
      (count, subject) => count + subject.records,
      0,
    ),
    by_subject: bySubject,
  };
}

function buildCatalogSnapshotRowCounts(snapshot: CatalogSnapshot | null) {
  if (!snapshot) return { courses: 0, sections: 0 };
  return {
    courses: snapshot.courses.length,
    sections: snapshot.courses.reduce(
      (count, course) => count + course.sections.length,
      0,
    ),
  };
}

function sourceRowCounts(
  source: CollectedSource<
    ParsedScheduleOfClasses | GeneralCatalogCourse[] | GradeArchiveRecord[]
  >,
): { [key: string]: number } {
  if (source.source === 'schedule_of_classes')
    return scheduleSubjectCounts(source.data as ParsedScheduleOfClasses);

  if (source.source === 'general_catalog') {
    return {
      courses: (source.data as GeneralCatalogCourse[]).length,
    };
  }

  return {
    records: (source.data as GradeArchiveRecord[]).length,
  };
}

function sourceReport(
  source: CollectedSource<
    ParsedScheduleOfClasses | GeneralCatalogCourse[] | GradeArchiveRecord[]
  >,
) {
  return {
    source: source.source,
    subject: source.subject,
    fetched_at: source.fetched_at,
    source_timestamp: source.source_timestamp,
    raw_artifacts: source.raw_artifacts,
    normalized_artifact: source.normalized_artifact,
    row_counts: sourceRowCounts(source),
  };
}

function buildReport(options: {
  config: CatalogSnapshotConfig;
  runId: string;
  generatedAt: string;
  status: PipelineStatus;
  scheduleSources: CollectedSource<ParsedScheduleOfClasses>[];
  generalCatalogSources: CollectedSource<GeneralCatalogCourse[]>[];
  gradeArchiveSources: CollectedSource<GradeArchiveRecord[]>[];
  snapshot: CatalogSnapshot | null;
  validation: ValidationResult;
  errors: PipelineError[];
  parserErrors: PipelineError[];
  stagingSnapshotPath: string | null;
  publishedSnapshotPath: string | null;
  metadataPath: string | null;
}): PublishedSnapshotImportReport {
  const allSources = [
    ...options.scheduleSources,
    ...options.generalCatalogSources,
    ...options.gradeArchiveSources,
  ];
  return {
    run_id: options.runId,
    generated_at: options.generatedAt,
    active_planning_term: options.config.active_planning_term,
    term_label: options.config.term_label,
    configured_subjects: options.config.configured_subjects,
    status: options.status,
    source_timestamps: {
      schedule_of_classes: firstTimestamp(options.scheduleSources),
      general_catalog: firstTimestamp(options.generalCatalogSources),
      instructor_grade_archive: firstTimestamp(options.gradeArchiveSources),
    },
    sources: allSources.map(sourceReport),
    row_counts: {
      schedule_of_classes: buildScheduleRowCounts(options.scheduleSources),
      general_catalog: buildGeneralCatalogRowCounts(
        options.generalCatalogSources,
      ),
      instructor_grade_archive: buildGradeArchiveRowCounts(
        options.gradeArchiveSources,
      ),
      catalog_snapshot: buildCatalogSnapshotRowCounts(options.snapshot),
    },
    validation: options.validation,
    errors: options.errors,
    parser_errors: options.parserErrors,
    raw_artifacts: allSources.flatMap((source) => source.raw_artifacts),
    normalized_artifacts: [
      ...allSources.map((source) => source.normalized_artifact),
      ...(options.stagingSnapshotPath ? [options.stagingSnapshotPath] : []),
    ],
    staging_snapshot_path: options.stagingSnapshotPath,
    published_snapshot_path: options.publishedSnapshotPath,
    metadata_path: options.metadataPath,
  };
}

function defaultSourceLoaders(): PublishedSnapshotSourceLoaders {
  return {
    async scheduleOfClasses(subject, context) {
      const rawSource = await fetchRawScheduleOfClassesForSubject(subject, {
        term: context.config.active_planning_term,
        fetch: context.fetch,
        fetchedAt: context.generatedAt,
      });
      return {
        subject: rawSource.subject,
        fetched_at: rawSource.fetched_at,
        raw_files: [
          {
            filename: `${safePathComponent(subject)}.subject-list.json`,
            contents: rawSource.subject_list_raw,
          },
          {
            filename: `${safePathComponent(subject)}.html`,
            contents: rawSource.html,
          },
        ],
        parse() {
          const parsed = parseScheduleOfClassesHtml(rawSource.html, {
            subject,
            term: context.config.active_planning_term,
            sourceUrl: rawSource.source_url,
            fetchedAt: rawSource.fetched_at,
          });
          if (!parsed.courses.length) {
            throw new Error(
              `UCSD Schedule returned no courses for ${subject} ${context.config.active_planning_term}`,
            );
          }
          return {
            source_timestamp: parsed.source_timestamp,
            data: parsed,
          };
        },
      };
    },
    async generalCatalog(subject, context) {
      const rawSource = await fetchRawGeneralCatalogForSubject(subject, {
        fetch: context.fetch,
        fetchedAt: context.generatedAt,
      });
      return {
        subject: rawSource.subject,
        fetched_at: rawSource.fetched_at,
        raw_files: [
          {
            filename: `${safePathComponent(subject)}.html`,
            contents: rawSource.html,
          },
        ],
        parse() {
          return {
            source_timestamp: rawSource.fetched_at,
            data: parseGeneralCatalogHtml(rawSource.html, {
              subject,
              sourceUrl: rawSource.source_url,
            }),
          };
        },
      };
    },
    async instructorGradeArchive(subject, context) {
      const rawSource = await fetchRawInstructorGradeArchiveForSubject(
        subject,
        {
          fetch: context.fetch,
          fetchedAt: context.generatedAt,
        },
      );
      return {
        subject: rawSource.subject,
        fetched_at: rawSource.fetched_at,
        raw_files: [
          {
            filename: `${safePathComponent(subject)}.html`,
            contents: rawSource.html,
          },
        ],
        parse() {
          return {
            source_timestamp: rawSource.fetched_at,
            data: parseInstructorGradeArchiveHtml(rawSource.html),
          };
        },
      };
    },
  };
}

function buildSnapshot(options: {
  config: CatalogSnapshotConfig;
  runId: string;
  generatedAt: string;
  scheduleSources: CollectedSource<ParsedScheduleOfClasses>[];
  generalCatalogSources: CollectedSource<GeneralCatalogCourse[]>[];
  gradeArchiveSources: CollectedSource<GradeArchiveRecord[]>[];
}): CatalogSnapshot {
  const baseSnapshot = buildScheduleCatalogSnapshot(
    options.config,
    options.scheduleSources.map((source) => source.data),
    {
      runId: options.runId,
      generatedAt: options.generatedAt,
    },
  );
  const catalogCourses = options.generalCatalogSources.flatMap(
    (source) => source.data,
  );
  const gradeArchiveRecords = options.gradeArchiveSources.flatMap(
    (source) => source.data,
  );
  const enrichedSnapshot = attachGradeArchiveRecords(
    attachGeneralCatalogMetadata(baseSnapshot, catalogCourses),
    gradeArchiveRecords,
  );

  return {
    ...enrichedSnapshot,
    source_timestamps: {
      schedule_of_classes: firstTimestamp(options.scheduleSources),
      general_catalog: firstTimestamp(options.generalCatalogSources),
      instructor_grade_archive: firstTimestamp(options.gradeArchiveSources),
    },
  };
}

export async function runPublishedSnapshotPipeline(
  config: CatalogSnapshotConfig,
  options: {
    runId?: string;
    generatedAt?: string;
    fetch?: FetchAdapter;
    sourceLoaders?: PublishedSnapshotSourceLoaders;
  } = {},
): Promise<PublishedSnapshotPipelineResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const runId = options.runId ?? defaultRunId(generatedAt);
  const paths = {
    rawRoot: pathModule.join(config.paths.raw_dir, runId),
    normalizedRoot: pathModule.join(config.paths.normalized_dir, runId),
    reportPath: pathModule.join(
      config.paths.reports_dir,
      `${runId}.import-report.json`,
    ),
  };
  const context = {
    config,
    runId,
    generatedAt,
    fetch: options.fetch,
  };
  const sourceLoaders = options.sourceLoaders ?? defaultSourceLoaders();

  const scheduleResult = await collectSources(
    'schedule_of_classes',
    config.configured_subjects,
    sourceLoaders.scheduleOfClasses,
    context,
    paths,
  );
  const generalCatalogResult = await collectSources(
    'general_catalog',
    config.configured_subjects,
    sourceLoaders.generalCatalog,
    context,
    paths,
  );
  const gradeArchiveResult = await collectSources(
    'instructor_grade_archive',
    config.configured_subjects,
    sourceLoaders.instructorGradeArchive,
    context,
    paths,
  );
  const sourceErrors = [
    ...scheduleResult.errors,
    ...generalCatalogResult.errors,
    ...gradeArchiveResult.errors,
  ];

  await mkdir(config.paths.reports_dir, { recursive: true });

  if (sourceErrors.length) {
    const report = buildReport({
      config,
      runId,
      generatedAt,
      status: 'failed',
      scheduleSources: scheduleResult.collected,
      generalCatalogSources: generalCatalogResult.collected,
      gradeArchiveSources: gradeArchiveResult.collected,
      snapshot: null,
      validation: {
        success: false,
        errors: ['validation was not run because source collection failed'],
      },
      errors: sourceErrors,
      parserErrors: sourceErrors,
      stagingSnapshotPath: null,
      publishedSnapshotPath: null,
      metadataPath: null,
    });
    await writeJson(paths.reportPath, report);
    throw new Error(
      `Published Snapshot source collection failed:\n${sourceErrors
        .map((error) => error.message)
        .join('\n')}`,
    );
  }

  const snapshot = buildSnapshot({
    config,
    runId,
    generatedAt,
    scheduleSources: scheduleResult.collected,
    generalCatalogSources: generalCatalogResult.collected,
    gradeArchiveSources: gradeArchiveResult.collected,
  });
  const stagingSnapshotPath = pathModule.join(
    paths.normalizedRoot,
    'catalog_snapshot.staging.json',
  );
  await mkdir(paths.normalizedRoot, { recursive: true });
  await writeJson(stagingSnapshotPath, snapshot);

  const validation = validateCatalogSnapshot(snapshot, config);
  if (!validation.success) {
    const report = buildReport({
      config,
      runId,
      generatedAt,
      status: 'failed',
      scheduleSources: scheduleResult.collected,
      generalCatalogSources: generalCatalogResult.collected,
      gradeArchiveSources: gradeArchiveResult.collected,
      snapshot,
      validation,
      errors: [],
      parserErrors: [],
      stagingSnapshotPath,
      publishedSnapshotPath: null,
      metadataPath: null,
    });
    await writeJson(paths.reportPath, report);
    throw new Error(
      `Catalog Snapshot validation failed:\n${validation.errors.join('\n')}`,
    );
  }

  try {
    const publishResult = await publishCatalogSnapshot(snapshot, config);
    const report = buildReport({
      config,
      runId,
      generatedAt,
      status: 'published',
      scheduleSources: scheduleResult.collected,
      generalCatalogSources: generalCatalogResult.collected,
      gradeArchiveSources: gradeArchiveResult.collected,
      snapshot,
      validation,
      errors: [],
      parserErrors: [],
      stagingSnapshotPath,
      publishedSnapshotPath: publishResult.snapshotPath,
      metadataPath: publishResult.metadataPath,
    });
    await writeJson(paths.reportPath, report);
    return {
      report,
      reportPath: paths.reportPath,
      snapshotPath: publishResult.snapshotPath,
      metadataPath: publishResult.metadataPath,
    };
  } catch (err) {
    const errors = [
      {
        source: 'publish' as const,
        subject: null,
        phase: 'publish' as const,
        message: errorMessage(err),
      },
    ];
    const report = buildReport({
      config,
      runId,
      generatedAt,
      status: 'failed',
      scheduleSources: scheduleResult.collected,
      generalCatalogSources: generalCatalogResult.collected,
      gradeArchiveSources: gradeArchiveResult.collected,
      snapshot,
      validation,
      errors,
      parserErrors: [],
      stagingSnapshotPath,
      publishedSnapshotPath: null,
      metadataPath: null,
    });
    await writeJson(paths.reportPath, report);
    throw err;
  }
}
