import { describe, expect, it } from 'vitest';

import { hasCatalogSearchCondition } from './catalogSearchActivity';
import { defaultFilters } from './searchConstants';
import type { Season } from '../queries/graphql-types';

describe('Catalog search activity', () => {
  it('stays inactive outside Catalog for the default filters and sort-only changes', () => {
    expect(hasCatalogSearchCondition(defaultFilters, [])).toBe(false);
    expect(
      hasCatalogSearchCondition(
        {
          ...defaultFilters,
          selectSortBy: {
            value: 'title',
            label: 'Sort by course title',
          },
          sortOrder: 'desc',
        },
        [],
      ),
    ).toBe(false);
  });

  it('activates for a committed search or course type selection', () => {
    expect(
      hasCatalogSearchCondition({ ...defaultFilters, searchText: 'cse' }, []),
    ).toBe(true);
    expect(hasCatalogSearchCondition(defaultFilters, ['upper'])).toBe(true);
  });

  it.each([
    [
      'subject',
      {
        selectSubjects: [
          {
            value: 'CSE',
            label: 'CSE / Computer Science & Engineering',
          },
        ],
      },
    ],
    ['day', { selectDays: [{ value: 1, label: 'Monday' }] }],
    ['units', { selectCredits: [{ value: 4, label: '4 units' }] }],
    [
      'non-default term',
      {
        selectSeasons: [{ value: 'SP26' as Season, label: 'Spring 2026' }],
      },
    ],
    ['advanced course constraint', { hideConflicting: true }],
  ])('activates for a selected %s filter', (_label, overrides) => {
    expect(
      hasCatalogSearchCondition({ ...defaultFilters, ...overrides }, []),
    ).toBe(true);
  });
});
