import { describe, expect, it } from 'vitest';

import { buildCatalogListFilterCleanup } from './catalogListFilters';
import { defaultFilters } from './searchConstants';
import { sortByOptions, type Filters } from './searchTypes';
import type { Season } from '../queries/graphql-types';

describe('catalog list filter cleanup', () => {
  it('resets legacy hidden filters while preserving visible search and subject filters', () => {
    const visibleSubjects = [{ value: 'CSE', label: 'CSE' }];
    const filters: Filters = {
      ...defaultFilters,
      searchText: 'systems',
      selectSubjects: visibleSubjects,
      selectSkillsAreas: [
        { value: 'QR', label: 'QR - Quantitative Reasoning' },
      ],
      selectSeasons: [{ value: 'FA26' as Season, label: 'Fall 2026' }],
      overallBounds: [2, 4],
      selectBuilding: [{ value: 'HSS', label: 'HSS' }],
      searchDescription: false,
      hideConflicting: true,
      selectSortBy: sortByOptions.workload,
      sortOrder: 'desc',
    };

    expect(buildCatalogListFilterCleanup(filters)).toEqual({
      selectSkillsAreas: defaultFilters.selectSkillsAreas,
      overallBounds: defaultFilters.overallBounds,
      selectSeasons: defaultFilters.selectSeasons,
      selectBuilding: defaultFilters.selectBuilding,
      searchDescription: defaultFilters.searchDescription,
      hideConflicting: defaultFilters.hideConflicting,
      selectSortBy: defaultFilters.selectSortBy,
      sortOrder: defaultFilters.sortOrder,
    });
  });
});
