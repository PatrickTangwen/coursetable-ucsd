import { describe, expect, it } from 'vitest';

import { hasCatalogResultCondition } from './catalogResultVisibility';
import { defaultFilters } from './searchConstants';
import type { Season } from '../queries/graphql-types';

describe('Catalog result visibility', () => {
  it('keeps results idle for the default filter state and sort-only changes', () => {
    expect(hasCatalogResultCondition(defaultFilters, [])).toBe(false);
    expect(
      hasCatalogResultCondition(
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

  it('activates results for a committed search or course type selection', () => {
    expect(
      hasCatalogResultCondition({ ...defaultFilters, searchText: 'cse' }, []),
    ).toBe(true);
    expect(hasCatalogResultCondition(defaultFilters, ['upper'])).toBe(true);
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
  ])('activates results for a selected %s filter', (_label, overrides) => {
    expect(
      hasCatalogResultCondition({ ...defaultFilters, ...overrides }, []),
    ).toBe(true);
  });
});
