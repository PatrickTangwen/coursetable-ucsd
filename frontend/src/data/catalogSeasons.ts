import { CUR_SEASON } from '../config';
import seasonsData from '../generated/seasons.json';
import supportedTermsData from '../generated/supported-terms.json';
import type { Season } from '../queries/graphql-types';

const generatedSeasons = seasonsData as Season[];
const generatedSupportedTerms = supportedTermsData as Season[];

// Supported Terms (UCSD alpha term codes) that have a Published or Frozen
// Catalog Snapshot. Mirrors the metadata term registry written by the
// multi-term snapshot pipeline; drives the catalog term selector. See ADR 0012.
export const supportedTerms = [
  CUR_SEASON,
  ...generatedSupportedTerms.filter((term) => term !== CUR_SEASON),
];

// Every season the app is allowed to load. Supported Terms come first so the
// UCSD multi-term snapshots are loadable; the inherited numeric codes are kept
// for legacy consumers (worksheet, academic calendars).
export const seasons = [
  ...supportedTerms,
  ...generatedSeasons.filter((season) => !supportedTerms.includes(season)),
];
