import { describe, expect, it } from 'vitest';
import {
  getCatalogLastUpdated,
  getCatalogStalenessLabel,
  toRelativeUpdateTime,
} from './catalogFreshness';
import type { Season } from '../queries/graphql-types';

describe('catalog snapshot freshness display', () => {
  it('uses Published Snapshot metadata as the visible last-updated source', () => {
    const lastUpdate = new Date('2026-06-19T21:20:51.866Z');

    expect(
      getCatalogLastUpdated({
        FA26: {
          metadata: {
            last_update: lastUpdate,
          },
        },
      }).toISOString(),
    ).toBe('2026-06-19T21:20:51.866Z');
    expect(
      toRelativeUpdateTime(
        lastUpdate,
        new Date('2026-06-19T23:20:51.866Z').getTime(),
      ),
    ).toBe('2 hrs');
  });

  it('formats catalog staleness from the Supported Term registry', () => {
    const courses = {
      SP26: {
        metadata: {
          last_update: new Date('2026-06-20T12:00:00.000Z'),
          terms: [
            {
              term: 'SP26',
              label: 'Spring 2026',
              date_range: { start: '2026-03-30', end: '2026-06-12' },
              frozen: false,
              generated_at: '2026-06-20T12:00:00.000Z',
              snapshot_path: 'catalogs/public/SP26.json',
              manifest_path: 'catalogs/import-manifests/SP26.json',
            },
            {
              term: 'FA26',
              label: 'Fall 2026',
              date_range: { start: '2026-09-24', end: '2026-12-12' },
              frozen: false,
              generated_at: '2026-06-26T12:00:00.000Z',
              snapshot_path: 'catalogs/public/FA26.json',
              manifest_path: 'catalogs/import-manifests/FA26.json',
            },
          ],
        },
      },
      FA26: {
        metadata: {
          last_update: new Date('2026-06-26T12:00:00.000Z'),
          terms: [
            {
              term: 'SP26',
              label: 'Spring 2026',
              date_range: { start: '2026-03-30', end: '2026-06-12' },
              frozen: false,
              generated_at: '2026-06-20T12:00:00.000Z',
              snapshot_path: 'catalogs/public/SP26.json',
              manifest_path: 'catalogs/import-manifests/SP26.json',
            },
            {
              term: 'FA26',
              label: 'Fall 2026',
              date_range: { start: '2026-09-24', end: '2026-12-12' },
              frozen: false,
              generated_at: '2026-06-26T12:00:00.000Z',
              snapshot_path: 'catalogs/public/FA26.json',
              manifest_path: 'catalogs/import-manifests/FA26.json',
            },
          ],
        },
      },
    };

    expect(
      getCatalogStalenessLabel(
        courses,
        'SP26' as Season,
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe('As of Jun 12, 2026 · historical snapshot, not live');
    expect(
      getCatalogStalenessLabel(
        courses,
        'FA26' as Season,
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe('Updated 1 day ago');
  });
});
