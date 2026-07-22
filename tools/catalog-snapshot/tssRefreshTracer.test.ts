import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { CatalogSnapshotConfig } from './catalogSnapshot';
import { runTssRefreshTracer } from './tssRefreshTracer';

const tempDirectories: string[] = [];
const fixtureDirectory = path.resolve(
  'tools/catalog-snapshot/fixtures/tss-refresh-tracer',
);

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function tracerConfig(outputDirectory: string): CatalogSnapshotConfig {
  return {
    active_planning_term: 'FA26',
    term_label: 'Fall 2026',
    term_date_range: { start: '2026-09-24', end: '2026-12-12' },
    term_date_ranges: {
      FA26: { start: '2026-09-24', end: '2026-12-12' },
    },
    configured_subjects: ['CAT'],
    paths: {
      raw_dir: path.join(outputDirectory, 'pipeline-raw'),
      normalized_dir: path.join(outputDirectory, 'pipeline-normalized'),
      reports_dir: path.join(outputDirectory, 'reports'),
      public_catalog_dir: path.join(outputDirectory, 'public'),
      metadata_path: path.join(outputDirectory, 'metadata.json'),
    },
  };
}

async function exists(pathname: string) {
  try {
    await access(pathname);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

describe('credential-free TSS refresh tracer', () => {
  it('publishes a source-neutral artifact immutably and reads it through the Catalog API', async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), 'tss-refresh-tracer-'),
    );
    tempDirectories.push(outputDirectory);
    const config = tracerConfig(outputDirectory);

    const result = await runTssRefreshTracer({
      config,
      scheduleArtifactDirectory: path.join(fixtureDirectory, 'schedule'),
      metadataDirectory: path.join(fixtureDirectory, 'normalized'),
      metadataSourceTimestamp: '2026-07-20T12:00:00.000Z',
      runId: 'credential-free-tss-refresh-tracer',
      generatedAt: '2026-07-21T16:10:00.000Z',
    });

    expect(result.snapshot).toMatchObject({
      active_planning_term: 'FA26',
      configured_subjects: ['CAT'],
      coverage: { complete: true, continuation_needed: false },
      source_timestamps: {
        schedule_of_classes: '2026-07-21T09:00:00-07:00',
      },
      courses: [
        {
          course_id: 'CAT:1',
          title: 'Culture, Art, and Technology 1',
          sections: [
            {
              section_id: 'FA26:154333',
              section_code: 'CAT-001 (P-001-001)',
              source_package_display_id: 'SE00154333',
              source_package_status_text: 'Entry successfully validated',
              available_seats: 60,
            },
          ],
        },
      ],
    });
    expect(result.manifest).toMatchObject({
      active_planning_term: 'FA26',
      summary: { ok: 2, empty: 1, failed: 0, partial: 0 },
    });
    expect(result.publication.snapshotKey).toMatch(
      /^published-snapshots\/FA26\/[a-f\d]{64}\.json$/u,
    );
    expect(result.publication.manifestKey).toMatch(
      /^published-manifests\/FA26\/[a-f\d]{64}\.json$/u,
    );
    expect(result.publication.writeOrder).toEqual([
      result.publication.snapshotKey,
      result.publication.manifestKey,
      'metadata.json',
    ]);
    expect(result.api.snapshot.status).toBe(200);
    expect(result.api.snapshot.body).toMatchObject({
      active_planning_term: 'FA26',
      courses: [{ course_id: 'CAT:1' }],
    });
    expect(result.api.metadata.status).toBe(200);
    expect(result.api.metadata.body).toMatchObject({
      terms: [
        expect.objectContaining({
          term: 'FA26',
          snapshot_path: result.publication.snapshotKey,
          manifest_path: result.publication.manifestKey,
        }),
      ],
    });
  });

  it('rejects contaminated artifacts before writing generated output', async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), 'tss-refresh-tracer-rejected-'),
    );
    tempDirectories.push(outputDirectory);
    const scheduleDirectory = path.join(outputDirectory, 'schedule');
    await mkdir(scheduleDirectory);
    const fixture = JSON.parse(
      await readFile(path.join(fixtureDirectory, 'schedule/CAT.json'), 'utf-8'),
    ) as {
      courses: ({ student_account?: { pid: string } } & {
        [key: string]: unknown;
      })[];
      [key: string]: unknown;
    };
    fixture.courses[0]!.student_account = { pid: 'A00000000' };
    await writeFile(
      path.join(scheduleDirectory, 'CAT.json'),
      JSON.stringify(fixture),
      'utf-8',
    );
    const config = tracerConfig(outputDirectory);

    await expect(
      runTssRefreshTracer({
        config,
        scheduleArtifactDirectory: scheduleDirectory,
        metadataDirectory: path.join(fixtureDirectory, 'normalized'),
        metadataSourceTimestamp: '2026-07-20T12:00:00.000Z',
        runId: 'credential-free-tss-refresh-rejected',
        generatedAt: '2026-07-21T16:10:00.000Z',
      }),
    ).rejects.toThrow(/Unrecognized key/u);
    expect(await exists(config.paths.metadata_path)).toBe(false);
    expect(
      await exists(path.join(config.paths.public_catalog_dir, 'FA26.json')),
    ).toBe(false);
  });
});
