import * as Sentry from '@sentry/react';
import type { StateCreator } from 'zustand';

import { seasons } from '../data/catalogSeasons';
import {
  loadCatalogSeason,
  shouldSkipCatalogRequest,
  subscribeToCatalogCache,
} from '../ferry/ferryCatalogCache';
import type { Season } from '../queries/graphql-types';
import type { Store } from '../store';

const FERRY_CATALOG_UNSUBSCRIBE_KEY = '__ct_ferryCatalogUnsubscribe';
type GlobalWithFerryCatalogListener = typeof globalThis & {
  [FERRY_CATALOG_UNSUBSCRIBE_KEY]?: () => void;
};

interface FerrySliceState {
  ferryRequests: number;
  // Load failures per season. Background loads never toast; surfaces that
  // requested a season derive their error state from this map.
  ferrySeasonErrors: { [season: Season]: object };
  ferryCatalogRevision: number;
}

interface FerrySliceActions {
  requestSeasons: (requestedSeasons: Season[]) => Promise<void>;
}

export interface FerrySlice extends FerrySliceState, FerrySliceActions {}

export const createFerrySlice: StateCreator<Store, [], [], FerrySlice> = (
  set,
  get,
) => {
  const globalWithFerryListener = globalThis as GlobalWithFerryCatalogListener;
  globalWithFerryListener[FERRY_CATALOG_UNSUBSCRIBE_KEY]?.();
  globalWithFerryListener[FERRY_CATALOG_UNSUBSCRIBE_KEY] =
    subscribeToCatalogCache(() => {
      set((state) => ({
        ferryCatalogRevision: state.ferryCatalogRevision + 1,
      }));
    });

  return {
    ferryRequests: 0,
    ferrySeasonErrors: {},
    ferryCatalogRevision: 0,

    async requestSeasons(requestedSeasons) {
      set((state) => {
        const cleared = { ...state.ferrySeasonErrors };
        for (const season of requestedSeasons) delete cleared[season];
        return { ferrySeasonErrors: cleared };
      });
      const failures = await Promise.all(
        requestedSeasons.map(async (season) => {
          if (!seasons.includes(season)) return null;
          const includeEvals = false;
          if (shouldSkipCatalogRequest(season, includeEvals)) return null;

          set({ ferryRequests: get().ferryRequests + 1 });
          try {
            await loadCatalogSeason(season, includeEvals);
            return null;
          } catch (err) {
            return { season, error: err as object };
          } finally {
            set({ ferryRequests: get().ferryRequests - 1 });
          }
        }),
      );
      const errors = failures.filter((failure) => failure !== null);
      if (errors.length > 0) {
        for (const { error } of errors) Sentry.captureException(error);
        set((state) => ({
          ferrySeasonErrors: {
            ...state.ferrySeasonErrors,
            ...Object.fromEntries(
              errors.map(({ season, error }) => [season, error]),
            ),
          },
        }));
      }
    },
  };
};
