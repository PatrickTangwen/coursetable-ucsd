/**
 * Instructor Grade Archive as an on-demand source (ADR 0045).
 *
 * The archive sits behind UCSD Single Sign-On, so unattended refreshes cannot
 * fetch it. In reuse mode each Configured Subject is served from the newest
 * prior normalized run that holds an archive artifact for it. The manifest
 * cell points at that artifact, retention keeps the run, and the source
 * timestamp stays the original fetch time.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GradeArchiveRecord } from './instructorGradeArchive';
import type { PublishedSnapshotSourceLoaders } from './publishedSnapshotPipeline';
import { inferredNormalizedRunTimestamp } from './tssPublishedSnapshotPipeline';

const sourceDirectoryName = 'instructor_grade_archive';

type ReusableSubject = {
  subject: string;
  run: string;
  artifactPath: string;
  sourceTimestamp: string;
  records: GradeArchiveRecord[];
};

export type ReusableInstructorGradeArchive = {
  bySubject: Map<string, ReusableSubject>;
  /** Distinct prior run directory names that serve at least one subject. */
  runs: string[];
  /** Distinct original fetch timestamps, ascending. */
  sourceTimestamps: string[];
};

async function directoryNames(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function artifactFileNames(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function readRecords(
  artifactPath: string,
): Promise<GradeArchiveRecord[]> {
  const value = JSON.parse(await readFile(artifactPath, 'utf-8')) as unknown;
  if (!Array.isArray(value))
    throw new Error(`${artifactPath} must contain an array of archive records`);
  return value as GradeArchiveRecord[];
}

/**
 * Select, per subject, the newest normalized run started before `before`
 * (the current run's generated_at) that holds an archive artifact.
 */
export async function loadReusableInstructorGradeArchive(options: {
  normalizedDirectory: string;
  before: string;
}): Promise<ReusableInstructorGradeArchive> {
  const chosen = new Map<string, Omit<ReusableSubject, 'records'>>();
  for (const run of await directoryNames(options.normalizedDirectory)) {
    const sourceTimestamp = inferredNormalizedRunTimestamp(run);
    if (!sourceTimestamp || sourceTimestamp >= options.before) continue;
    const sourceDirectory = path.join(
      options.normalizedDirectory,
      run,
      sourceDirectoryName,
    );
    for (const fileName of await artifactFileNames(sourceDirectory)) {
      const subject = path.basename(fileName, '.json').toUpperCase();
      const current = chosen.get(subject);
      const newer =
        !current ||
        sourceTimestamp > current.sourceTimestamp ||
        (sourceTimestamp === current.sourceTimestamp && run > current.run);
      if (newer) {
        chosen.set(subject, {
          subject,
          run,
          sourceTimestamp,
          artifactPath: path.join(sourceDirectory, fileName),
        });
      }
    }
  }
  if (chosen.size === 0) {
    throw new Error(
      `No prior Instructor Grade Archive artifacts to reuse under ` +
        `${options.normalizedDirectory}; run a live refresh first ` +
        `(run-refresh.mts --grade-archive live, see docs/etl_refresh.md)`,
    );
  }

  const bySubject = new Map<string, ReusableSubject>();
  for (const [subject, entry] of chosen) {
    bySubject.set(subject, {
      ...entry,
      records: await readRecords(entry.artifactPath),
    });
  }
  return {
    bySubject,
    runs: [...new Set([...bySubject.values()].map((e) => e.run))].sort(),
    sourceTimestamps: [
      ...new Set([...bySubject.values()].map((e) => e.sourceTimestamp)),
    ].sort(),
  };
}

export function reusedInstructorGradeArchiveLoader(
  reusable: ReusableInstructorGradeArchive,
): PublishedSnapshotSourceLoaders['instructorGradeArchive'] {
  return (subject) => {
    const entry = reusable.bySubject.get(subject.trim().toUpperCase());
    if (!entry) {
      throw new Error(
        `No prior Instructor Grade Archive artifact to reuse for ${subject}`,
      );
    }
    return {
      reused: true,
      subject: entry.subject,
      fetched_at: entry.sourceTimestamp,
      source_timestamp: entry.sourceTimestamp,
      normalized_artifact: entry.artifactPath,
      data: entry.records,
    };
  };
}
