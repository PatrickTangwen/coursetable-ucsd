import { describe, expect, it } from 'vitest';

import { buildTermArchive } from './termArchive.js';

describe('staging Term Archive', () => {
  it('builds a complete content-addressed registry from accepted repository artifacts', async () => {
    const archive = await buildTermArchive();

    expect(archive.registry.last_update).toBe('2026-07-22T21:35:00.817Z');
    expect(archive.terms).toHaveLength(15);
    expect(archive.registry.terms).toHaveLength(15);

    const fall = archive.terms.find(({ term }) => term === 'FA26');
    if (!fall) throw new Error('FA26 fixture is missing');
    expect(fall).toMatchObject({
      term: 'FA26',
      label: 'Fall 2026',
      dateRange: { start: '2026-09-24', end: '2026-12-12' },
      generatedAt: '2026-07-22T21:35:00.817Z',
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
    expect(fallDetails.courses).toHaveLength(1998);
    expect(
      fallDetails.courses.some(
        (course) => course.grade_archive_records.length > 0,
      ),
    ).toBe(true);

    const spring = archive.terms.find(({ term }) => term === 'SP26');
    if (!spring) throw new Error('SP26 fixture is missing');
    expect(spring).toMatchObject({
      term: 'SP26',
      label: 'Spring 2026',
      dateRange: { start: '2026-03-30', end: '2026-06-12' },
      generatedAt: '2026-06-29T08:02:01.606Z',
    });
    expect(spring.snapshot.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(spring.manifest.sha256).toMatch(/^[a-f\d]{64}$/u);

    const registryEntry = archive.registry.terms.find(
      ({ term }) => term === 'SP26',
    );
    expect(registryEntry).toMatchObject({
      term: 'SP26',
      label: 'Spring 2026',
      date_range: { start: '2026-03-30', end: '2026-06-12' },
      frozen: false,
      generated_at: '2026-06-29T08:02:01.606Z',
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
