import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildTermArchive } from './termArchive.js';

describe('staging Term Archive', () => {
  it('builds a complete content-addressed registry from accepted repository artifacts', async () => {
    const metadata = JSON.parse(
      await readFile(
        path.join(process.cwd(), 'api/static/metadata.json'),
        'utf8',
      ),
    ) as {
      last_update: string;
      terms: {
        term: string;
        label: string;
        date_range: { start: string; end: string } | null;
        generated_at: string;
      }[];
    };
    const archive = await buildTermArchive();

    expect(archive.registry.last_update).toBe(metadata.last_update);
    expect(archive.terms).toHaveLength(metadata.terms.length);
    expect(archive.registry.terms).toHaveLength(metadata.terms.length);

    const fall = archive.terms.find(({ term }) => term === 'FA26');
    const fallMetadata = metadata.terms.find(({ term }) => term === 'FA26');
    if (!fall) throw new Error('FA26 fixture is missing');
    if (!fallMetadata) throw new Error('FA26 metadata is missing');
    expect(fall).toMatchObject({
      term: 'FA26',
      label: fallMetadata.label,
      dateRange: fallMetadata.date_range,
      generatedAt: fallMetadata.generated_at,
    });
    expect(fall.snapshot.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(fall.details.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(fall.manifest.sha256).toMatch(/^[a-f\d]{64}$/u);
    const fallList = JSON.parse(
      new TextDecoder().decode(fall.snapshot.body),
    ) as {
      courses: { grade_archive_records?: unknown }[];
    };
    expect(
      fallList.courses.every(
        (course) => !Object.hasOwn(course, 'grade_archive_records'),
      ),
    ).toBe(true);
    const fallDetails = JSON.parse(
      new TextDecoder().decode(fall.details.body),
    ) as {
      active_planning_term: string;
      courses: { course_id: string; grade_archive_records: unknown[] }[];
    };
    expect(fallDetails.active_planning_term).toBe('FA26');
    expect(fallDetails.courses).toHaveLength(fallList.courses.length);
    expect(
      fallDetails.courses.some(
        (course) => course.grade_archive_records.length > 0,
      ),
    ).toBe(true);

    const spring = archive.terms.find(({ term }) => term === 'SP26');
    const springMetadata = metadata.terms.find(({ term }) => term === 'SP26');
    if (!spring) throw new Error('SP26 fixture is missing');
    if (!springMetadata) throw new Error('SP26 metadata is missing');
    expect(spring).toMatchObject({
      term: 'SP26',
      label: springMetadata.label,
      dateRange: springMetadata.date_range,
      generatedAt: springMetadata.generated_at,
    });
    expect(spring.snapshot.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(spring.manifest.sha256).toMatch(/^[a-f\d]{64}$/u);

    const registryEntry = archive.registry.terms.find(
      ({ term }) => term === 'SP26',
    );
    expect(registryEntry).toMatchObject({
      term: 'SP26',
      label: springMetadata.label,
      date_range: springMetadata.date_range,
      frozen: false,
      generated_at: springMetadata.generated_at,
    });
    expect(registryEntry?.snapshot_path).toBe(
      `published-snapshots/SP26/${spring.snapshot.sha256}.json`,
    );
    expect(registryEntry?.detail_path).toBe(
      `published-details/SP26/${spring.details.sha256}.json`,
    );
    expect(registryEntry?.manifest_path).toBe(
      `published-manifests/SP26/${spring.manifest.sha256}.json`,
    );
  });

  it('preserves durable R2-only and Frozen Snapshots across deployments', async () => {
    const frozenSnapshotDigest = 'a'.repeat(64);
    const frozenManifestDigest = 'b'.repeat(64);
    const r2OnlySnapshotDigest = 'c'.repeat(64);
    const r2OnlyManifestDigest = 'd'.repeat(64);
    const archive = await buildTermArchive(process.cwd(), {
      last_update: '2026-06-01T00:00:00.000Z',
      terms: [
        {
          term: 'FA24',
          label: 'Fall 2024',
          date_range: { start: '2024-09-26', end: '2024-12-14' },
          frozen: true,
          generated_at: '2025-01-01T00:00:00.000Z',
          snapshot_path: `published-snapshots/FA24/${frozenSnapshotDigest}.json`,
          detail_path: null,
          manifest_path: `published-manifests/FA24/${frozenManifestDigest}.json`,
        },
        {
          term: 'SP24',
          label: 'Spring 2024',
          date_range: null,
          frozen: false,
          generated_at: '2024-06-15T00:00:00.000Z',
          snapshot_path: `published-snapshots/SP24/${r2OnlySnapshotDigest}.json`,
          detail_path: null,
          manifest_path: `published-manifests/SP24/${r2OnlyManifestDigest}.json`,
        },
      ],
    });

    expect(archive.registry.terms).toEqual(
      expect.arrayContaining([
        {
          term: 'FA24',
          label: 'Fall 2024',
          date_range: { start: '2024-09-26', end: '2024-12-14' },
          frozen: true,
          generated_at: '2025-01-01T00:00:00.000Z',
          snapshot_path: `published-snapshots/FA24/${frozenSnapshotDigest}.json`,
          detail_path: null,
          manifest_path: `published-manifests/FA24/${frozenManifestDigest}.json`,
        },
        {
          term: 'SP24',
          label: 'Spring 2024',
          date_range: null,
          frozen: true,
          generated_at: '2024-06-15T00:00:00.000Z',
          snapshot_path: `published-snapshots/SP24/${r2OnlySnapshotDigest}.json`,
          detail_path: null,
          manifest_path: `published-manifests/SP24/${r2OnlyManifestDigest}.json`,
        },
      ]),
    );
    expect(archive.terms.some(({ term }) => term === 'FA24')).toBe(false);
    expect(archive.terms.some(({ term }) => term === 'SP24')).toBe(false);
  });
});
