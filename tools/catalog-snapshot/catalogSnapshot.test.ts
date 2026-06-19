import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  attachGradeArchiveRecords,
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

describe('Catalog Snapshot Grade Archive enrichment', () => {
  it('attaches matching Grade Archive Records and computes unweighted Archive Avg GPA', () => {
    const config = makeConfig();
    const snapshot = buildTracerCatalogSnapshot(config, {
      runId: 'run-test',
      generatedAt: '2026-06-19T12:00:00.000Z',
    });

    const enriched = attachGradeArchiveRecords(snapshot, [
      {
        subject: 'CSE',
        course: '1',
        year: '2025',
        quarter: 'FA',
        title: 'CSE Tracer Course',
        instructor: 'Hopper, Grace',
        gpa: 3,
        a: 40,
        b: 30,
        c: 20,
        d: 5,
        f: 1,
        w: 4,
        p: 0,
        np: 0,
        raw: {
          Subject: 'CSE',
          Course: '1',
          Year: '2025',
          Quarter: 'FA',
          Title: 'CSE Tracer Course',
          Instructor: 'Hopper, Grace',
          GPA: '3.00',
          A: '40',
          B: '30',
          C: '20',
          D: '5',
          F: '1',
          W: '4',
          P: '0',
          NP: '0',
        },
      },
      {
        subject: 'CSE',
        course: '1',
        year: '2024',
        quarter: 'WI',
        title: 'CSE Tracer Course',
        instructor: 'Lovelace, Ada',
        gpa: null,
        a: null,
        b: 30,
        c: 20,
        d: 5,
        f: 1,
        w: 4,
        p: 0,
        np: 0,
        raw: {
          Subject: 'CSE',
          Course: '1',
          Year: '2024',
          Quarter: 'WI',
          Title: 'CSE Tracer Course',
          Instructor: 'Lovelace, Ada',
          GPA: '',
          A: '',
          B: '30',
          C: '20',
          D: '5',
          F: '1',
          W: '4',
          P: '0',
          NP: '0',
        },
      },
      {
        subject: 'MATH',
        course: '1',
        year: '2024',
        quarter: 'SP',
        title: 'MATH Tracer Course',
        instructor: 'Noether, Emmy',
        gpa: 4,
        a: 80,
        b: 15,
        c: 5,
        d: 0,
        f: 0,
        w: 0,
        p: 0,
        np: 0,
        raw: {
          Subject: 'MATH',
          Course: '1',
          Year: '2024',
          Quarter: 'SP',
          Title: 'MATH Tracer Course',
          Instructor: 'Noether, Emmy',
          GPA: '4.00',
          A: '80',
          B: '15',
          C: '5',
          D: '0',
          F: '0',
          W: '0',
          P: '0',
          NP: '0',
        },
      },
    ]);

    expect(enriched.courses[0]).toMatchObject({
      archive_avg_gpa: 3,
      archive_record_count: 2,
      grade_archive_records: [
        {
          instructor: 'Hopper, Grace',
          gpa: 3,
          raw: {
            GPA: '3.00',
          },
        },
        {
          instructor: 'Lovelace, Ada',
          gpa: null,
          raw: {
            GPA: '',
          },
        },
      ],
    });
    expect(enriched.courses[1]).toMatchObject({
      archive_avg_gpa: 4,
      archive_record_count: 1,
    });
    expect(validateCatalogSnapshot(enriched, config)).toEqual({
      success: true,
      errors: [],
    });
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
