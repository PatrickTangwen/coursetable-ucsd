import { CUR_SEASON } from '../config';
import seasonsData from '../generated/seasons.json';
import type { Season } from '../queries/graphql-types';

const generatedSeasons = seasonsData as Season[];

export const seasons = [
  CUR_SEASON,
  ...generatedSeasons.filter((season) => season !== CUR_SEASON),
];
