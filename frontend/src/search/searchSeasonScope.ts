import type { Option } from './searchTypes';
import { supportedTerms } from '../data/catalogSeasons';
import type { Season } from '../queries/graphql-types';

export function getSearchSeasonScope(
  selectedSeasons: Option<Season>[],
  hasActiveCatalogFilter: boolean,
) {
  // Without an active catalog filter no results are rendered, so the search
  // needs no season data — even when a (default) term selection exists.
  if (!hasActiveCatalogFilter) return [];
  if (selectedSeasons.length > 0)
    return selectedSeasons.map((season) => season.value);
  return supportedTerms;
}
