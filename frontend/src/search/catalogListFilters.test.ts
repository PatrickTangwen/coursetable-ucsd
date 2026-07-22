import { describe, expect, it } from 'vitest';

import {
  buildCatalogListAdvancedFilterReset,
  buildCatalogListFilterCleanup,
  countCatalogListAdvancedFilters,
  getActiveCatalogListAdvancedFilterKeys,
} from './catalogListFilters';
import { defaultFilters } from './searchConstants';
import { sortByOptions, type Filters } from './searchTypes';
import type { Season } from '../queries/graphql-types';

describe('catalog list filter cleanup', () => {
  it('does not silently reset filters that the catalog list chips can clear', () => {
    const visibleSubjects = [{ value: 'CSE', label: 'CSE' }];
    const filters: Filters = {
      ...defaultFilters,
      searchText: 'systems',
      selectSubjects: visibleSubjects,
      selectDays: [{ value: 1, label: 'Monday' }],
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

    expect(buildCatalogListFilterCleanup(filters)).toEqual({});
  });

  it('counts non-primary filters for the Advanced chip', () => {
    const filters: Filters = {
      ...defaultFilters,
      searchText: 'systems',
      selectSubjects: [{ value: 'CSE', label: 'CSE' }],
      selectSeasons: [{ value: 'FA26' as Season, label: 'Fall 2026' }],
      selectDays: [{ value: 1, label: 'Monday' }],
      selectSkillsAreas: [
        { value: 'QR', label: 'QR - Quantitative Reasoning' },
      ],
      selectBuilding: [{ value: 'HSS', label: 'HSS' }],
      hideConflicting: true,
    };

    expect(countCatalogListAdvancedFilters(filters)).toBe(3);
    expect(getActiveCatalogListAdvancedFilterKeys(filters)).toEqual([
      'selectSkillsAreas',
      'selectBuilding',
      'hideConflicting',
    ]);
  });

  it('builds a reset patch for Advanced chip filters only', () => {
    const reset = buildCatalogListAdvancedFilterReset();

    expect(reset.searchText).toBeUndefined();
    expect(reset.selectSubjects).toBeUndefined();
    expect(reset.selectSeasons).toBeUndefined();
    expect(reset.selectDays).toBeUndefined();
    expect(reset.selectSkillsAreas).toEqual(defaultFilters.selectSkillsAreas);
    expect(reset.selectBuilding).toEqual(defaultFilters.selectBuilding);
    expect(reset.hideConflicting).toBe(defaultFilters.hideConflicting);
  });

  it('builds a reset patch for one selected Advanced menu item', () => {
    const reset = buildCatalogListAdvancedFilterReset(['selectBuilding']);

    expect(reset).toEqual({
      selectBuilding: defaultFilters.selectBuilding,
    });
  });
});
