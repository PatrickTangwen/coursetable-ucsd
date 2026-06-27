import type { StateCreator } from 'zustand';

import type { Store } from '../store';

export type CatalogSortKey = 'code' | 'title' | 'term' | 'meets';

export interface CatalogViewSliceState {
  catalogExpandedCourses: Set<string>;
  catalogSortKey: CatalogSortKey;
  catalogSortAsc: boolean;
  catalogLevelFilter: string | null;
}

export interface CatalogViewSliceActions {
  toggleCatalogExpanded: (courseId: string) => void;
  setCatalogSort: (key: CatalogSortKey) => void;
  setCatalogLevelFilter: (level: string | null) => void;
}

export interface CatalogViewSlice
  extends CatalogViewSliceState, CatalogViewSliceActions {}

export const createCatalogViewSlice: StateCreator<
  Store,
  [],
  [],
  CatalogViewSlice
> = (set) => ({
  catalogExpandedCourses: new Set(),
  catalogSortKey: 'code',
  catalogSortAsc: true,
  catalogLevelFilter: null,

  toggleCatalogExpanded: (courseId) =>
    set((state) => {
      const next = new Set(state.catalogExpandedCourses);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return { catalogExpandedCourses: next };
    }),

  setCatalogSort: (key) =>
    set((state) => {
      if (state.catalogSortKey === key)
        return { catalogSortAsc: !state.catalogSortAsc };

      return { catalogSortKey: key, catalogSortAsc: true };
    }),

  setCatalogLevelFilter: (level) => set({ catalogLevelFilter: level }),
});
