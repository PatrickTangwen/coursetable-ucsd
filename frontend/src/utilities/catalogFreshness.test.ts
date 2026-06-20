import { describe, expect, it } from 'vitest';
import {
  getCatalogLastUpdated,
  toRelativeUpdateTime,
} from './catalogFreshness';

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
});
