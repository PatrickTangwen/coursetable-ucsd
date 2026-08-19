/**
 * Bounded local ETL retention. Published/Frozen Snapshots remain durable;
 * dated raw and normalized runs remain only while a current manifest, the
 * pre-refresh manifest set, or an explicit replay/audit pin reaches them.
 * See ADR 0044.
 */

import { lstat, readFile, readdir, rm } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export type DataRetentionPin = {
  directory: string;
  reason: string;
};

export type DataRetentionPolicy = {
  version: 1;
  pinned_directories: DataRetentionPin[];
};

export type DataRetentionResult = {
  removedRawRuns: string[];
  removedNormalizedRuns: string[];
  retainedRuns: string[];
  missingPinnedRuns: string[];
  removedImportReports: string[];
  removedStagingSnapshots: string[];
  removedBeforeDirectories: string[];
};

type ApplyDataRetentionOptions = {
  rawDirectory: string;
  normalizedDirectory: string;
  reportsDirectory: string;
  referencedArtifacts: string[];
  policy?: DataRetentionPolicy;
  workingDirectory?: string;
};

type ManifestCell = {
  raw_artifacts?: unknown;
  normalized_artifact?: unknown;
};

const multiRunPattern = /^multi-\d{4}-\d{2}-\d{2}T.+Z-.+/u;
const classplannerRunPattern = /^\d{4}-\d{2}-\d{2}T.+Z$/u;
const termPattern = /^[\w-]+$/u;

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function pathExists(pathname: string): Promise<boolean> {
  try {
    await lstat(pathname);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function directoryEntries(pathname: string) {
  try {
    return await readdir(pathname, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Read local artifact references that make an Import Manifest auditable. */
export async function readManifestArtifactPaths(
  manifestDirectory: string,
): Promise<string[]> {
  const artifacts = new Set<string>();
  const entries = await directoryEntries(manifestDirectory);
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const manifestPath = join(manifestDirectory, entry.name);
    const value = JSON.parse(await readFile(manifestPath, 'utf-8')) as unknown;
    if (!isRecord(value) || !Array.isArray(value.cells))
      throw new Error(`${manifestPath} is not an Import Manifest`);

    for (const cellValue of value.cells) {
      if (!isRecord(cellValue))
        throw new Error(`${manifestPath} contains an invalid manifest cell`);

      const cell = cellValue as ManifestCell;
      if (!Array.isArray(cell.raw_artifacts)) {
        throw new Error(
          `${manifestPath} contains a cell without raw_artifacts`,
        );
      }
      for (const artifact of cell.raw_artifacts) {
        if (typeof artifact !== 'string')
          throw new Error(`${manifestPath} contains a non-string raw artifact`);

        artifacts.add(artifact);
      }
      if (
        cell.normalized_artifact !== null &&
        typeof cell.normalized_artifact !== 'string'
      ) {
        throw new Error(
          `${manifestPath} contains an invalid normalized artifact`,
        );
      }
      if (typeof cell.normalized_artifact === 'string')
        artifacts.add(cell.normalized_artifact);
    }
  }
  return [...artifacts].sort();
}

/** Load the checked-in replay/audit exceptions to reachability retention. */
export async function loadDataRetentionPolicy(
  policyPath: string,
): Promise<DataRetentionPolicy> {
  const value = JSON.parse(await readFile(policyPath, 'utf-8')) as unknown;
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.pinned_directories)
  )
    throw new Error(`${policyPath} is not a version 1 ETL retention policy`);

  const pins = value.pinned_directories.map((pin, index) => {
    if (
      !isRecord(pin) ||
      typeof pin.directory !== 'string' ||
      pin.directory.trim() === '' ||
      typeof pin.reason !== 'string' ||
      pin.reason.trim() === ''
    )
      throw new Error(`${policyPath} has an invalid pin at index ${index}`);

    return { directory: pin.directory, reason: pin.reason };
  });
  return { version: 1, pinned_directories: pins };
}

function containsPath(directory: string, pathname: string): boolean {
  const child = relative(directory, pathname);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..');
}

function resolvedPath(pathname: string, workingDirectory: string): string {
  return isAbsolute(pathname)
    ? resolve(pathname)
    : resolve(workingDirectory, pathname);
}

async function datedMultiRuns(root: string): Promise<string[]> {
  const entries = await directoryEntries(root);
  return entries
    .filter((entry) => entry.isDirectory() && multiRunPattern.test(entry.name))
    .map((entry) => join(root, entry.name));
}

async function datedClassplannerRuns(rawRoot: string): Promise<string[]> {
  const classplannerRoot = join(rawRoot, 'classplanner');
  const termEntries = await directoryEntries(classplannerRoot);
  const runs: string[] = [];
  for (const termEntry of termEntries) {
    if (!termEntry.isDirectory() || !termPattern.test(termEntry.name)) continue;
    const termRoot = join(classplannerRoot, termEntry.name);
    const runEntries = await directoryEntries(termRoot);
    for (const runEntry of runEntries) {
      if (runEntry.isDirectory() && classplannerRunPattern.test(runEntry.name))
        runs.push(join(termRoot, runEntry.name));
    }
  }
  return runs;
}

function managedPin(
  pin: string,
  rawRoot: string,
  normalizedRoot: string,
): boolean {
  if (containsPath(rawRoot, pin)) {
    const rawParts = relative(rawRoot, pin).split(sep);
    if (rawParts.length === 1) return multiRunPattern.test(rawParts[0] ?? '');
    return (
      rawParts.length === 3 &&
      rawParts[0] === 'classplanner' &&
      termPattern.test(rawParts[1] ?? '') &&
      classplannerRunPattern.test(rawParts[2] ?? '')
    );
  }
  if (!containsPath(normalizedRoot, pin)) return false;
  const normalizedParts = relative(normalizedRoot, pin).split(sep);
  return (
    normalizedParts.length === 1 &&
    multiRunPattern.test(normalizedParts[0] ?? '')
  );
}

/**
 * Prune only recognized dated run directories after a fully successful ETL
 * refresh. Unknown directories are outside this module's deletion authority.
 */
export async function applyDataRetention(
  options: ApplyDataRetentionOptions,
): Promise<DataRetentionResult> {
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const rawRoot = resolvedPath(options.rawDirectory, workingDirectory);
  const normalizedRoot = resolvedPath(
    options.normalizedDirectory,
    workingDirectory,
  );
  const reportsRoot = resolvedPath(options.reportsDirectory, workingDirectory);
  const rawRuns = [
    ...(await datedMultiRuns(rawRoot)),
    ...(await datedClassplannerRuns(rawRoot)),
  ].sort();
  const normalizedRuns = (await datedMultiRuns(normalizedRoot)).sort();
  const candidates = [...rawRuns, ...normalizedRuns];
  const references = options.referencedArtifacts.map((artifact) =>
    resolvedPath(artifact, workingDirectory),
  );
  const pinned = new Set<string>();
  const missingPinnedRuns: string[] = [];
  for (const pin of options.policy?.pinned_directories ?? []) {
    const directory = resolvedPath(pin.directory, workingDirectory);
    if (!managedPin(directory, rawRoot, normalizedRoot)) {
      throw new Error(
        `Retention pin is outside a managed dated run: ${pin.directory}`,
      );
    }
    pinned.add(directory);
    if (!(await pathExists(directory))) missingPinnedRuns.push(directory);
  }

  const retainedRuns = candidates.filter(
    (directory) =>
      pinned.has(directory) ||
      references.some((artifact) => containsPath(directory, artifact)),
  );
  const staleRuns = candidates.filter(
    (directory) => !retainedRuns.includes(directory),
  );
  const removedRawRuns = staleRuns.filter((directory) =>
    containsPath(rawRoot, directory),
  );
  const removedNormalizedRuns = staleRuns.filter((directory) =>
    containsPath(normalizedRoot, directory),
  );
  for (const directory of staleRuns) await rm(directory, { recursive: true });

  const removedImportReports: string[] = [];
  for (const entry of await directoryEntries(reportsRoot)) {
    const suffix = '.import-report.json';
    if (!entry.isFile() || !entry.name.endsWith(suffix)) continue;
    const runName = entry.name.slice(0, -suffix.length);
    if (!multiRunPattern.test(runName)) continue;
    const rawRun = join(rawRoot, runName);
    if (
      pinned.has(rawRun) ||
      references.some((artifact) => containsPath(rawRun, artifact))
    )
      continue;
    const reportPath = join(reportsRoot, entry.name);
    await rm(reportPath);
    removedImportReports.push(reportPath);
  }

  const removedStagingSnapshots: string[] = [];
  for (const directory of retainedRuns) {
    if (!containsPath(normalizedRoot, directory)) continue;
    const stagingPath = join(directory, 'catalog_snapshot.staging.json');
    if (!(await pathExists(stagingPath))) continue;
    await rm(stagingPath);
    removedStagingSnapshots.push(stagingPath);
  }

  const removedBeforeDirectories: string[] = [];
  const etlReportsRoot = join(reportsRoot, 'etl');
  for (const entry of await directoryEntries(etlReportsRoot)) {
    if (!entry.isDirectory()) continue;
    const completedReport = join(etlReportsRoot, entry.name);
    const jsonReport = join(completedReport, 'refresh-report.json');
    const markdownReport = join(completedReport, 'refresh-report.md');
    const beforeDirectory = join(completedReport, 'before');
    if (
      !(await pathExists(jsonReport)) ||
      !(await pathExists(markdownReport)) ||
      !(await pathExists(beforeDirectory))
    )
      continue;
    await rm(beforeDirectory, { recursive: true });
    removedBeforeDirectories.push(beforeDirectory);
  }

  return {
    removedRawRuns,
    removedNormalizedRuns,
    retainedRuns,
    missingPinnedRuns,
    removedImportReports,
    removedStagingSnapshots,
    removedBeforeDirectories,
  };
}
