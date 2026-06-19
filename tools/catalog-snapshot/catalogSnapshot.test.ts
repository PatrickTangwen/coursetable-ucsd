import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTracerCatalogSnapshot,
  loadCatalogSnapshotConfig,
  publishCatalogSnapshot,
  validateCatalogSnapshot,
  type CatalogSnapshotConfig,
} from './catalogSnapshot';

function makeConfig(): CatalogSnapshotConfig {
  return {
    active_planning_term: 'FA26',
    term_label: 'Fall 2026',
    term_date_range: {
      start: '2026-09-24',
      end: '2026-12-12',
    },
    configured_subjects: ['CSE', 'MATH'],
    paths: {
      raw_dir: 'data/raw',
      normalized_dir: 'data/normalized',
      reports_dir: 'data/reports',
      public_catalog_dir: 'api/static/catalogs/public',
      metadata_path: 'api/static/metadata.json',
    },
  };
}

describe('Catalog Snapshot config', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('loads Active Planning Term, subjects, term dates, and publish paths from YAML', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'catalog-snapshot-config-'));
    tempDirs.push(dir);
    const configPath = join(dir, 'catalog-snapshot.yaml');
    await writeFile(
      configPath,
      [
        'active_planning_term: FA26',
        'term_label: Fall 2026',
        'term_date_range:',
        '  start: "2026-09-24"',
        '  end: "2026-12-12"',
        'configured_subjects:',
        '  - CSE',
        '  - MATH',
        'paths:',
        '  raw_dir: data/raw',
        '  normalized_dir: data/normalized',
        '  reports_dir: data/reports',
        '  public_catalog_dir: api/static/catalogs/public',
        '  metadata_path: api/static/metadata.json',
        '',
      ].join('\n'),
      'utf-8',
    );

    const config = await loadCatalogSnapshotConfig(configPath);

    expect(config).toEqual(makeConfig());
  });
});

describe('Catalog Snapshot validation', () => {
  it('accepts a minimal tracer snapshot for every configured subject', () => {
    const config = makeConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-test',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });

    const result = validateCatalogSnapshot(snapshot, config);

    expect(result).toEqual({ success: true, errors: [] });
  });

  it('rejects snapshots missing a configured subject', () => {
    const config = makeConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-test',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });
    snapshot.courses = snapshot.courses.filter(
      (course) => course.subject !== 'MATH',
    );

    const result = validateCatalogSnapshot(snapshot, config);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['missing configured subject MATH']),
    );
  });

  it('rejects sections without stable Section IDs for the Active Planning Term', () => {
    const config = makeConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-test',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });
    snapshot.courses[0]!.sections[0]!.section_id = 'CSE-TRACER-001';

    const result = validateCatalogSnapshot(snapshot, config);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'courses[0].sections[0].section_id must start with FA26:',
      ]),
    );
  });

  it('rejects excluded Availability Data and demand fields', () => {
    const config = makeConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-test',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });
    snapshot.courses[0]!.sections[0]!.raw = {
      waitlist: 10,
      demand: 'high',
    };

    const result = validateCatalogSnapshot(snapshot, config);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'excluded field $.courses[0].sections[0].raw.waitlist',
        'excluded field $.courses[0].sections[0].raw.demand',
      ]),
    );
  });
});

describe('Catalog Snapshot publishing', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function makeTempConfig() {
    const dir = await mkdtemp(join(tmpdir(), 'catalog-snapshot-'));
    tempDirs.push(dir);
    const config = makeConfig();
    return {
      ...config,
      paths: {
        ...config.paths,
        public_catalog_dir: join(dir, 'public'),
        metadata_path: join(dir, 'metadata.json'),
      },
    };
  }

  it('publishes a validated tracer snapshot and metadata to configured paths', async () => {
    const config = await makeTempConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-publish',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });

    const result = await publishCatalogSnapshot(snapshot, config);

    const publishedSnapshot = JSON.parse(
      await readFile(result.snapshotPath, 'utf-8'),
    ) as unknown;
    const metadata = JSON.parse(
      await readFile(config.paths.metadata_path, 'utf-8'),
    ) as { run_id?: string; active_planning_term?: string };

    expect(result.snapshotPath).toBe(
      join(config.paths.public_catalog_dir, 'FA26.json'),
    );
    expect(publishedSnapshot).toMatchObject({
      run_id: 'run-publish',
      active_planning_term: 'FA26',
    });
    expect(metadata).toMatchObject({
      run_id: 'run-publish',
      active_planning_term: 'FA26',
    });
  });

  it('does not overwrite the existing Published Snapshot when validation fails', async () => {
    const config = await makeTempConfig();
    const existingSnapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-existing',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });
    const invalidSnapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-invalid',
      generatedAt: '2026-06-19T13:00:00.000Z',
    });
    invalidSnapshot.courses[0]!.sections[0]!.raw = {
      seats_available: 20,
    };

    const result = await publishCatalogSnapshot(existingSnapshot, config);
    await expect(
      publishCatalogSnapshot(invalidSnapshot, config),
    ).rejects.toThrow(/validation failed/u);

    const stillPublished = JSON.parse(
      await readFile(result.snapshotPath, 'utf-8'),
    ) as { run_id?: string };
    const metadata = JSON.parse(
      await readFile(config.paths.metadata_path, 'utf-8'),
    ) as { run_id?: string };

    expect(stillPublished.run_id).toBe('run-existing');
    expect(metadata.run_id).toBe('run-existing');
  });
});
