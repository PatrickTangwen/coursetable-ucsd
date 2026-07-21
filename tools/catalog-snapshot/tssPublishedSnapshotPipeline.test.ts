import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { CatalogSnapshotConfig } from './catalogSnapshot';
import { runTssPublishedSnapshotPipeline } from './tssPublishedSnapshotPipeline';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('TSS Published Snapshot entrypoint', () => {
  it('reads raw and metadata directories and publishes a self-contained FA26 snapshot', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'tss-pipeline-'));
    tempDirectories.push(root);
    const rawDirectory = path.join(root, 'raw');
    const metadataDirectory = path.join(root, 'normalized');
    const generalDirectory = path.join(metadataDirectory, 'general_catalog');
    const gradeDirectory = path.join(
      metadataDirectory,
      'instructor_grade_archive',
    );
    const publicDirectory = path.join(root, 'public');
    await Promise.all([
      mkdir(rawDirectory, { recursive: true }),
      mkdir(generalDirectory, { recursive: true }),
      mkdir(gradeDirectory, { recursive: true }),
    ]);

    await writeFile(
      path.join(rawDirectory, 'CAT.json'),
      JSON.stringify({
        schema_version: 'tss-chatbot-v1',
        term: 'FA26',
        source_metadata: { last_refreshed_displayed: null },
        coverage: { complete: true, continuation_needed: false },
        courses: [
          {
            course_code: '001',
            course_title: 'CAT 001',
            tss_course_code: 'CAT-001',
            booking_choices: [],
          },
        ],
      }),
      'utf-8',
    );
    await writeFile(
      path.join(generalDirectory, 'CAT.json'),
      JSON.stringify([
        {
          course_id: 'CAT:1',
          subject: 'CAT',
          course_number: '1',
          title: 'Culture, Art, and Technology 1',
          units: '4',
          description: 'General Catalog description.',
          prerequisites_text: null,
          restrictions_text: null,
          catalog_url: 'https://catalog.ucsd.edu/courses/CAT.html#cat1',
        },
      ]),
      'utf-8',
    );
    await writeFile(path.join(gradeDirectory, 'CAT.json'), '[]', 'utf-8');
    const metadataPath = path.join(root, 'metadata.json');
    await writeFile(
      metadataPath,
      JSON.stringify({
        last_update: '2026-07-20T12:00:00.000Z',
        terms: [
          {
            term: 'SP26',
            label: 'Spring 2026',
            date_range: null,
            frozen: false,
            generated_at: '2026-07-20T12:00:00.000Z',
            snapshot_path: 'catalogs/public/SP26.json',
            manifest_path: 'catalogs/import-manifests/SP26.json',
          },
        ],
      }),
      'utf-8',
    );

    const config: CatalogSnapshotConfig = {
      active_planning_term: 'SP26',
      term_label: 'Spring 2026',
      term_date_range: null,
      term_date_ranges: {
        FA26: { start: '2026-09-24', end: '2026-12-12' },
      },
      configured_subjects: ['CSE'],
      paths: {
        raw_dir: path.join(root, 'pipeline-raw'),
        normalized_dir: path.join(root, 'pipeline-normalized'),
        reports_dir: path.join(root, 'reports'),
        public_catalog_dir: publicDirectory,
        metadata_path: metadataPath,
      },
    };
    const result = await runTssPublishedSnapshotPipeline({
      config,
      rawDirectory,
      metadataDirectory,
      metadataSourceTimestamp: '2026-06-29T08:02:01.606Z',
      runId: 'tss-entrypoint-test',
      generatedAt: '2026-07-21T12:00:00.000Z',
    });
    const published = JSON.parse(
      await readFile(result.snapshotPath, 'utf-8'),
    ) as { courses: { [key: string]: unknown }[] };
    const registry = JSON.parse(await readFile(metadataPath, 'utf-8')) as {
      terms: { term: string; frozen: boolean }[];
    };

    expect(result.snapshot).toMatchObject({
      active_planning_term: 'FA26',
      term_label: 'Fall 2026',
      configured_subjects: ['CAT', 'CSE'],
      coverage: { complete: false, continuation_needed: true },
    });
    expect(published.courses[0]).toMatchObject({
      course_id: 'CAT:1',
      display_course_code: 'CAT-001',
      description: 'General Catalog description.',
      catalog_url: 'https://catalog.ucsd.edu/courses/CAT.html#cat1',
    });
    expect(registry.terms).toMatchObject([
      { term: 'FA26', frozen: false },
      { term: 'SP26', frozen: false },
    ]);
  });
});
