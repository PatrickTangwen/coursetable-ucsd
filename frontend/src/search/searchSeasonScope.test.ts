import { describe, expect, it } from 'vitest';

import { getSearchSeasonScope } from './searchSeasonScope';
import { supportedTerms } from '../data/catalogSeasons';
import type { Season } from '../queries/graphql-types';

describe('getSearchSeasonScope', () => {
  it('uses explicitly selected seasons', () => {
    expect(
      getSearchSeasonScope([
        { value: 'S126' as Season, label: 'Summer Session 1 2026' },
      ]),
    ).toEqual(['S126']);
  });

  it('searches all supported terms when no term is selected', () => {
    expect(getSearchSeasonScope([])).toEqual(supportedTerms);
  });
});
