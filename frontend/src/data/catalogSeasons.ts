import { CUR_SEASON } from '../config';
import seasonsData from '../generated/seasons.json';
import supportedTermsData from '../generated/supported-terms.json';
import type { Season } from '../queries/graphql-types';
import { compareSeasonsByRecency } from '../utilities/course';

const generatedSeasons = seasonsData as Season[];
const generatedSupportedTerms = supportedTermsData as Season[];

// Supported Terms (UCSD alpha term codes) that have a Published or Frozen
// Catalog Snapshot. Mirrors the metadata term registry written by the
// multi-term snapshot pipeline; drives the catalog term selector. See ADR 0012.
export const supportedTerms = [
  CUR_SEASON,
  ...generatedSupportedTerms.filter((term) => term !== CUR_SEASON),
].sort(compareSeasonsByRecency);

const worksheetTermRange = {
  start: 'S126' as Season,
  end: CUR_SEASON,
};

function isInWorksheetTermRange(term: Season) {
  return (
    compareSeasonsByRecency(term, worksheetTermRange.end) >= 0 &&
    compareSeasonsByRecency(term, worksheetTermRange.start) <= 0
  );
}

// Worksheet planning is intentionally narrower than Catalog browsing.
export const worksheetTerms = supportedTerms.filter(isInWorksheetTermRange);
const worksheetTermSet = new Set<Season>(worksheetTerms);

export function isWorksheetTerm(term: Season) {
  return worksheetTermSet.has(term);
}

// Every season the app is allowed to load. Supported Terms come first so the
// UCSD multi-term snapshots are loadable; the inherited numeric codes are kept
// for legacy consumers (worksheet, academic calendars).
export const seasons = [
  ...supportedTerms,
  ...generatedSeasons.filter((season) => !supportedTerms.includes(season)),
];
