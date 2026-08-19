import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyDataRetention,
  loadDataRetentionPolicy,
  readManifestArtifactPaths,
} from './dataRetention';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function tempDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'etl-retention-'));
  tempDirectories.push(directory);
  return directory;
}

async function write(pathname: string, contents = 'fixture') {
  await mkdir(join(pathname, '..'), { recursive: true });
  await writeFile(pathname, contents);
}

function manifest(rawArtifacts: string[], normalizedArtifact: string | null) {
  return {
    cells: [
      {
        raw_artifacts: rawArtifacts,
        normalized_artifact: normalizedArtifact,
      },
    ],
  };
}

describe('ETL data retention', () => {
  it('reads raw and normalized provenance from Import Manifests', async () => {
    const root = await tempDirectory();
    const manifests = join(root, 'manifests');
    await mkdir(manifests);
    await writeFile(
      join(manifests, 'FA26.json'),
      JSON.stringify(
        manifest(
          ['data/raw/classplanner/FA26/run/tss/schedule.json'],
          'data/normalized/multi-run/general_catalog/CSE.json',
        ),
      ),
    );
    await writeFile(join(manifests, 'README.md'), 'ignored');

    await expect(readManifestArtifactPaths(manifests)).resolves.toEqual([
      'data/normalized/multi-run/general_catalog/CSE.json',
      'data/raw/classplanner/FA26/run/tss/schedule.json',
    ]);
  });

  it('fails closed on malformed manifest provenance', async () => {
    const root = await tempDirectory();
    const manifests = join(root, 'manifests');
    await mkdir(manifests);
    await writeFile(
      join(manifests, 'FA26.json'),
      JSON.stringify({ cells: [{ normalized_artifact: null }] }),
    );

    await expect(readManifestArtifactPaths(manifests)).rejects.toThrow(
      /without raw_artifacts/u,
    );
  });

  it('keeps reachable and pinned runs while pruning superseded dates', async () => {
    const root = await tempDirectory();
    const raw = join(root, 'data', 'raw');
    const normalized = join(root, 'data', 'normalized');
    const reports = join(root, 'data', 'reports');
    const reportDirectory = join(reports, 'etl', 'candidate');

    const baselineRaw = join(
      raw,
      'multi-2026-08-13T11:00:00.000Z-baseline-FA25',
    );
    const candidateRaw = join(
      raw,
      'multi-2026-08-17T11:00:00.000Z-candidate-FA25',
    );
    const staleRaw = join(raw, 'multi-2026-08-10T11:00:00.000Z-stale-FA25');
    const pinnedRaw = join(
      raw,
      'multi-2026-06-29T11:00:00.000Z-parser-replay-FA25',
    );
    const candidatePlanner = join(
      raw,
      'classplanner',
      'FA26',
      '2026-08-17T12-30-00-000Z',
    );
    const stalePlanner = join(
      raw,
      'classplanner',
      'FA26',
      '2026-08-10T12-30-00-000Z',
    );
    const manualFixture = join(raw, 'manual-fixture');

    const baselineNormalized = join(
      normalized,
      'multi-2026-08-13T11:00:00.000Z-baseline-FA25',
    );
    const candidateNormalized = join(
      normalized,
      'multi-2026-08-17T11:00:00.000Z-candidate-FA25',
    );
    const staleNormalized = join(
      normalized,
      'multi-2026-08-10T11:00:00.000Z-stale-FA25',
    );

    for (const directory of [
      baselineRaw,
      candidateRaw,
      staleRaw,
      pinnedRaw,
      candidatePlanner,
      stalePlanner,
      manualFixture,
      baselineNormalized,
      candidateNormalized,
      staleNormalized,
    ])
      await write(join(directory, 'fixture.json'));

    await write(
      join(baselineNormalized, 'catalog_snapshot.staging.json'),
      'staging',
    );
    await write(
      join(candidateNormalized, 'catalog_snapshot.staging.json'),
      'staging',
    );
    await write(join(reports, `${basename(staleRaw)}.import-report.json`));
    const orphanRun = 'multi-2026-08-01T11:00:00.000Z-orphan-FA25';
    await write(join(reports, `${orphanRun}.import-report.json`));
    await write(join(reportDirectory, 'before', 'public', 'FA25.json'));
    await write(join(reportDirectory, 'refresh-report.md'), 'report');
    await write(join(reportDirectory, 'refresh-report.json'), '{}');
    const incompleteReportDirectory = join(reports, 'etl', 'incomplete');
    await write(
      join(incompleteReportDirectory, 'before', 'public', 'FA25.json'),
    );

    const missingPin = join(raw, 'multi-2026-07-01T11:00:00.000Z-missing-FA25');
    const missingPinnedReport = join(
      reports,
      `${basename(missingPin)}.import-report.json`,
    );
    await write(missingPinnedReport);
    const result = await applyDataRetention({
      rawDirectory: raw,
      normalizedDirectory: normalized,
      reportsDirectory: reports,
      referencedArtifacts: [
        join(baselineRaw, 'fixture.json'),
        join(candidateRaw, 'fixture.json'),
        join(candidatePlanner, 'fixture.json'),
        join(baselineNormalized, 'fixture.json'),
        join(candidateNormalized, 'fixture.json'),
      ],
      policy: {
        version: 1,
        pinned_directories: [
          { directory: pinnedRaw, reason: 'AIP parser replay evidence' },
          { directory: missingPin, reason: 'available only in cold storage' },
        ],
      },
    });

    expect(result.removedRawRuns).toEqual([stalePlanner, staleRaw].sort());
    expect(result.removedNormalizedRuns).toEqual([staleNormalized]);
    expect(result.missingPinnedRuns).toEqual([missingPin]);
    expect(result.removedImportReports).toHaveLength(2);
    expect(result.removedStagingSnapshots).toHaveLength(2);
    expect(result.removedBeforeDirectories).toEqual([
      join(reportDirectory, 'before'),
    ]);

    for (const removed of [staleRaw, stalePlanner, staleNormalized])
      await expect(access(removed)).rejects.toThrow();
    for (const retained of [
      baselineRaw,
      candidateRaw,
      pinnedRaw,
      candidatePlanner,
      baselineNormalized,
      candidateNormalized,
      manualFixture,
    ])
      await expect(access(retained)).resolves.toBeUndefined();
    await expect(
      access(join(baselineNormalized, 'catalog_snapshot.staging.json')),
    ).rejects.toThrow();
    await expect(access(join(reportDirectory, 'before'))).rejects.toThrow();
    await expect(
      access(join(incompleteReportDirectory, 'before')),
    ).resolves.toBeUndefined();
    await expect(access(missingPinnedReport)).resolves.toBeUndefined();
    await expect(
      readFile(join(reportDirectory, 'refresh-report.md'), 'utf-8'),
    ).resolves.toBe('report');
  });

  it('rejects a pin outside the managed dated-run boundaries', async () => {
    const root = await tempDirectory();
    await expect(
      applyDataRetention({
        rawDirectory: join(root, 'data', 'raw'),
        normalizedDirectory: join(root, 'data', 'normalized'),
        reportsDirectory: join(root, 'data', 'reports'),
        referencedArtifacts: [],
        policy: {
          version: 1,
          pinned_directories: [
            { directory: root, reason: 'too broad by construction' },
          ],
        },
      }),
    ).rejects.toThrow(/outside a managed dated run/u);
  });

  it('loads a versioned policy with non-empty audit reasons', async () => {
    const root = await tempDirectory();
    const policyPath = join(root, 'retention.json');
    await writeFile(
      policyPath,
      JSON.stringify({
        version: 1,
        pinned_directories: [
          { directory: 'data/raw/multi-run', reason: 'parser replay' },
        ],
      }),
    );
    await expect(loadDataRetentionPolicy(policyPath)).resolves.toEqual({
      version: 1,
      pinned_directories: [
        { directory: 'data/raw/multi-run', reason: 'parser replay' },
      ],
    });
  });
});
