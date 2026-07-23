import { fetchCatalogDetails } from '../queries/api';
import type { CoursePlanningPastGrade } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';

type CatalogDetails = Map<string, CoursePlanningPastGrade[]>;

const detailsBySeason = new Map<Season, CatalogDetails>();
const inflightBySeason = new Map<Season, Promise<CatalogDetails>>();
let cacheGeneration = 0;

export function resetCatalogDetailsCache() {
  cacheGeneration += 1;
  detailsBySeason.clear();
  inflightBySeason.clear();
}

function loadCatalogDetails(season: Season): Promise<CatalogDetails> {
  const cached = detailsBySeason.get(season);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightBySeason.get(season);
  if (inflight) return inflight;

  const requestGeneration = cacheGeneration;
  const request = fetchCatalogDetails(season)
    .then((details) => {
      if (!details) throw new Error('Catalog details are unavailable');
      if (requestGeneration === cacheGeneration)
        detailsBySeason.set(season, details);
      return details;
    })
    .finally(() => {
      if (inflightBySeason.get(season) === request)
        inflightBySeason.delete(season);
    });
  inflightBySeason.set(season, request);
  return request;
}

export async function loadCatalogPastGrades(
  season: Season,
  courseId: string,
): Promise<CoursePlanningPastGrade[]> {
  const details = await loadCatalogDetails(season);
  const records = details.get(courseId);
  if (!records) throw new Error(`Catalog details do not include ${courseId}`);
  return records;
}
