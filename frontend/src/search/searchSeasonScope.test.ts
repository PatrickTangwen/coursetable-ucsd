import { describe, expect, it } from 'vitest';

import { getSearchSeasonScope } from './searchSeasonScope';
import { supportedTerms } from '../data/catalogSeasons';
import type { Season } from '../queries/graphql-types';

describe('getSearchSeasonScope', () => {
  it('uses explicitly selected seasons', () => {
    expect(
      getSearchSeasonScope(
        [{ value: 'S126' as Season, label: 'Summer Session 1 2026' }],
        true,
      ),
    ).toEqual(['S126']);
  });

  it('keeps an empty season scope when there are no active catalog filters', () => {
    expect(getSearchSeasonScope([], false)).toEqual([]);
  });

  it('keeps an empty season scope for selected seasons without active catalog filters', () => {
    expect(
      getSearchSeasonScope(
        [{ value: 'S126' as Season, label: 'Summer Session 1 2026' }],
        false,
      ),
    ).toEqual([]);
  });

  it('searches all supported terms when no term is selected and a catalog filter is active', () => {
    expect(getSearchSeasonScope([], true)).toEqual(supportedTerms);
  });
});
