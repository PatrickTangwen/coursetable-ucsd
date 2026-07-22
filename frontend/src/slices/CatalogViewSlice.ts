import type { StateCreator } from 'zustand';

import type { CatalogSearchSuggestion } from '../search/catalogSearchSuggestions';
import type { Store } from '../store';

export type CatalogSortKey = 'code' | 'title' | 'term' | 'meets';

export interface CatalogViewSliceState {
  catalogExpandedCourses: Set<string>;
  catalogSortKey: CatalogSortKey;
  catalogSortAsc: boolean;
  catalogTypeFilters: string[];
  catalogSearchSelection: CatalogSearchSuggestion | null;
}

export interface CatalogViewSliceActions {
  toggleCatalogExpanded: (courseId: string) => void;
  setCatalogSort: (key: CatalogSortKey) => void;
  toggleCatalogTypeFilter: (type: string) => void;
  clearCatalogTypeFilters: () => void;
  setCatalogSearchSelection: (
    selection: CatalogSearchSuggestion | null,
  ) => void;
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
  catalogTypeFilters: [],
  catalogSearchSelection: null,

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

  toggleCatalogTypeFilter: (type) =>
    set((state) => ({
      catalogTypeFilters: state.catalogTypeFilters.includes(type)
        ? state.catalogTypeFilters.filter((t) => t !== type)
        : [...state.catalogTypeFilters, type],
    })),

  clearCatalogTypeFilters: () => set({ catalogTypeFilters: [] }),
  setCatalogSearchSelection: (selection) =>
    set({ catalogSearchSelection: selection }),
});
