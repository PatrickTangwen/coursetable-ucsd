import { describe, expect, it } from 'vitest';

import { getFilterFromParams } from './params';
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
});
