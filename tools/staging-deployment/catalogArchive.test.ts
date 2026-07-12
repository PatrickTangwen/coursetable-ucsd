import { describe, expect, it } from 'vitest';

import { buildTermArchive } from './catalogArchive.js';

describe('staging Term Archive', () => {
  it('builds a complete content-addressed registry from accepted repository artifacts', async () => {
    const archive = await buildTermArchive();

    expect(archive.registry.last_update).toBe('2026-07-02T01:57:13.859Z');
    expect(archive.terms).toHaveLength(14);
    expect(archive.registry.terms).toHaveLength(14);

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
    expect(registryEntry?.manifest_path).toBe(
      `published-manifests/SP26/${spring.manifest.sha256}.json`,
    );
  });
});
