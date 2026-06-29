import { describe, expect, it } from 'vitest';

import { getFilterFromParams } from './params';
import { defaultFilters } from '../search/searchConstants';
import type { Filters } from '../search/searchTypes';

describe('getFilterFromParams', () => {
  it('preserves discovered UCSD subject codes that are not in the legacy subject map', () => {
    const result = getFilterFromParams(
      'selectSubjects',
      'ANAR',
      [] as Filters['selectSubjects'],
    );

    expect(result).toEqual([
      { value: 'ANAR', label: 'ANAR - Anthropological Archaeology' },
    ]);
  });

  it('treats an empty season param as an explicit empty season selection', () => {
    const result = getFilterFromParams(
      'selectSeasons',
      '',
      defaultFilters.selectSeasons,
    );

    expect(result).toEqual([]);
  });
});
