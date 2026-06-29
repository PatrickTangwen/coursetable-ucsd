import type { Option } from './searchTypes';
import { supportedTerms } from '../data/catalogSeasons';
import type { Season } from '../queries/graphql-types';

export function getSearchSeasonScope(
  selectedSeasons: Option<Season>[],
  hasActiveCatalogFilter: boolean,
) {
  if (selectedSeasons.length > 0)
    return selectedSeasons.map((season) => season.value);
  if (!hasActiveCatalogFilter) return [];
  return supportedTerms;
}
