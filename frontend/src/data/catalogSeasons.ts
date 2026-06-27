import { CUR_SEASON } from '../config';
import seasonsData from '../generated/seasons.json';
import supportedTermsData from '../generated/supported-terms.json';
import type { Season } from '../queries/graphql-types';

const generatedSeasons = seasonsData as Season[];

export const seasons = [
  CUR_SEASON,
  ...generatedSeasons.filter((season) => season !== CUR_SEASON),
];

// Supported Terms (UCSD alpha term codes) that have a Published or Frozen
// Catalog Snapshot. Mirrors the metadata term registry written by the
// multi-term snapshot pipeline; drives the catalog term selector. See ADR 0012.
const generatedSupportedTerms = supportedTermsData as Season[];

export const supportedTerms = [
  CUR_SEASON,
  ...generatedSupportedTerms.filter((term) => term !== CUR_SEASON),
];
