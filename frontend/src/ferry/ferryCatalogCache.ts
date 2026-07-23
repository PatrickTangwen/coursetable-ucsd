import AsyncLock from 'async-lock';

import { resetCatalogDetailsCache } from './ferryCatalogDetailsCache';
import {
  fetchCatalogMetadata,
  fetchCatalog,
  fetchEvals,
  type CatalogMetadata,
  type CatalogListing,
} from '../queries/api';
import {
  coursePlanningSectionModalId,
  flattenCoursePlanningCatalog,
  type CoursePlanningCatalog,
  type CoursePlanningListing,
} from '../queries/coursePlanningViewModels';
import type { Crn, Season } from '../queries/graphql-types';
import {
  getUcsdSectionId,
  legacyCourseToPlanningEvaluation,
} from '../queries/ucsdCatalogSnapshot';
import {
  createCoursePlanningSearchIndex,
  type CoursePlanningSearchIndex,
} from '../search/coursePlanningSearch';

const courseDataLock = new AsyncLock();
const catalogLoadAttempted = new Set<Season>();
const evalsLoadAttempted = new Set<Season>();

type CourseData = {
  [seasonCode: Season]: {
    metadata: CatalogMetadata;
    catalog: CoursePlanningCatalog | null;
    listings: Map<string, CoursePlanningListing>;
    listingsByModalId: Map<Crn, CoursePlanningListing>;
    searchIndex: CoursePlanningSearchIndex;
    data: Map<Crn, CatalogListing>;
    legacyBySectionId: Map<string, CatalogListing>;
  };
};

let courseData: CourseData = {};

const catalogListeners = new Set<() => void>();

export function subscribeToCatalogCache(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

function notifyCatalogCacheUpdated() {
  for (const listener of catalogListeners) listener();
}

export function getCourseData(): CourseData {
  return courseData;
}

export const resetCatalogCache = () => {
  courseData = {};
  catalogLoadAttempted.clear();
  evalsLoadAttempted.clear();
  resetCatalogDetailsCache();
  notifyCatalogCacheUpdated();
};

const loadCatalog = (season: Season, includeEvals: boolean): Promise<void> =>
  courseDataLock.acquire(`load-${season}`, async () => {
    if (
      catalogLoadAttempted.has(season) &&
      (!includeEvals || evalsLoadAttempted.has(season))
    )
      return;

    const catalogPromise = (async () => {
      if (catalogLoadAttempted.has(season)) {
        if (courseData[season]) return null;
        catalogLoadAttempted.delete(season);
      }
      catalogLoadAttempted.add(season);
      try {
        const [data, metadata] = await Promise.all([
          fetchCatalog(season),
          fetchCatalogMetadata(),
        ]);
        if (!data || !metadata) {
          catalogLoadAttempted.delete(season);
          evalsLoadAttempted.delete(season);
          throw new Error('Failed to load catalog or metadata');
        }
        const catalogOldFormat = new Map<Crn, CatalogListing>();
        const legacyBySectionId = new Map<string, CatalogListing>();
        for (const course of data.legacyCourseMap.values()) {
          for (const listing of course.listings) {
            const catalogListing = { ...listing, course };
            catalogOldFormat.set(listing.crn, catalogListing);
            const sectionId = getUcsdSectionId(course);
            if (sectionId) legacyBySectionId.set(sectionId, catalogListing);
          }
        }
        const listings = new Map<string, CoursePlanningListing>();
        const listingsByModalId = new Map<Crn, CoursePlanningListing>();
        if (data.coursePlanningCatalog) {
          for (const listing of flattenCoursePlanningCatalog(
            data.coursePlanningCatalog,
          )) {
            listings.set(listing.section.sectionId, listing);
            listingsByModalId.set(
              coursePlanningSectionModalId(listing.section.sectionId) as Crn,
              listing,
            );
          }
        }
        return {
          metadata,
          catalog: data.coursePlanningCatalog,
          listings,
          listingsByModalId,
          searchIndex: createCoursePlanningSearchIndex([...listings.values()]),
          data: catalogOldFormat,
          legacyBySectionId,
        };
      } catch (err: unknown) {
        catalogLoadAttempted.delete(season);
        evalsLoadAttempted.delete(season);
        throw err;
      }
    })();

    const evalsPromise = (() => {
      if (evalsLoadAttempted.has(season) || !includeEvals)
        return Promise.resolve(null);
      evalsLoadAttempted.add(season);
      return fetchEvals(season)
        .then((evalsData) => {
          if (!evalsData) evalsLoadAttempted.delete(season);
          return evalsData;
        })
        .catch((err: unknown) => {
          evalsLoadAttempted.delete(season);
          throw err;
        });
    })();

    try {
      const [catalog, evals] = await Promise.all([
        catalogPromise,
        evalsPromise,
      ]);
      const seasonCatalog = catalog ?? courseData[season];
      if (!seasonCatalog) {
        catalogLoadAttempted.delete(season);
        evalsLoadAttempted.delete(season);
        throw new Error('No catalog data available for season');
      }
      if (evals) {
        const courseById = new Map<number, CatalogListing['course']>();
        for (const listing of seasonCatalog.data.values())
          courseById.set(listing.course.course_id, listing.course);
        for (const [courseId, ratings] of evals) {
          const course = courseById.get(courseId);
          if (course) Object.assign(course, ratings);
        }
        for (const [
          sectionId,
          legacyListing,
        ] of seasonCatalog.legacyBySectionId) {
          const listing = seasonCatalog.listings.get(sectionId);
          if (listing) {
            listing.evaluation = legacyCourseToPlanningEvaluation(
              legacyListing.course,
            );
          }
        }
      }
      courseData = {
        ...courseData,
        [season]: seasonCatalog,
      };
      notifyCatalogCacheUpdated();
    } catch (err: unknown) {
      if (!courseData[season]) {
        catalogLoadAttempted.delete(season);
        evalsLoadAttempted.delete(season);
      }
      throw err;
    }
  });

export function loadCatalogSeason(
  season: Season,
  includeEvals: boolean,
): Promise<void> {
  return loadCatalog(season, includeEvals);
}

export function shouldSkipCatalogRequest(
  season: Season,
  includeEvals: boolean,
): boolean {
  return (
    catalogLoadAttempted.has(season) &&
    (!includeEvals || evalsLoadAttempted.has(season))
  );
}

export function getLegacyCatalogListing(
  term: Season,
  sectionId: string,
): CatalogListing | undefined {
  return courseData[term]?.legacyBySectionId.get(sectionId);
}

export function requireLegacyCatalogListing(
  term: Season,
  sectionId: string,
): CatalogListing {
  const listing = getLegacyCatalogListing(term, sectionId);
  if (!listing)
    throw new Error(`Missing legacy Catalog boundary for ${term}:${sectionId}`);
  return listing;
}
