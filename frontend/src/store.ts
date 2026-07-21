import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createAuthSlice, type AuthSlice } from './slices/AuthSlice';
import {
  type CalendarSlice,
  createCalendarSlice,
} from './slices/CalendarSlice';
import {
  createCatalogViewSlice,
  type CatalogViewSlice,
} from './slices/CatalogViewSlice';
import {
  createCourseModalUISlice,
  type CourseModalUISlice,
} from './slices/CourseModalUISlice';
import {
  breakpoints,
  createDimensionsSlice,
  type DimensionsSlice,
} from './slices/DimensionsSlice';
import { createFerrySlice, type FerrySlice } from './slices/FerrySlice';
import { createGapiSlice, type GapiSlice } from './slices/GapiSlice';
import {
  createModalHistorySlice,
  type ModalHistorySlice,
} from './slices/ModalHistorySlice';
import {
  createProfileSlice,
  defaultPreferences,
  type ProfileSlice,
} from './slices/ProfileSlice';
import { createSearchSlice, type SearchSlice } from './slices/SearchSlice';
import { createThemeSlice, type ThemeSlice } from './slices/ThemeSlice';
import { createUserSlice, type UserSlice } from './slices/UserSlice';
import {
  createWorksheetSlice,
  useSavedWorksheetBootstrap,
  useWorksheetEffects,
  type WorksheetSlice,
} from './slices/WorksheetSlice';
import { pick } from './utilities/common';

export interface Store
  extends
    AuthSlice,
    CalendarSlice,
    CatalogViewSlice,
    CourseModalUISlice,
    UserSlice,
    ThemeSlice,
    DimensionsSlice,
    GapiSlice,
    ModalHistorySlice,
    ProfileSlice,
    FerrySlice,
    SearchSlice,
    WorksheetSlice {}

const basePersistKeys: (keyof Store)[] = [
  'authStatus',
  'theme',
  'coursePref',
  'professorPref',
  'viewedWorksheetNumber',
  'activeSavedWorksheetIdsByTerm',
  'worksheetView',
  'isCalendarViewLocked',
  'calendarLockStart',
  'calendarLockEnd',
];
const PersistKeys = basePersistKeys.concat(
  Object.keys(defaultPreferences) as (keyof Store)[],
);

function mergePersistedState(persistedState: unknown, currentState: Store) {
  if (!persistedState || typeof persistedState !== 'object')
    return currentState;

  const persisted = { ...(persistedState as Partial<Store>) };
  delete persisted.viewedSeason;
  return { ...currentState, ...persisted };
}

export const useStore = create<Store>()(
  persist(
    subscribeWithSelector(
      immer((...a) => ({
        ...createAuthSlice(...a),
        ...createCalendarSlice(...a),
        ...createCatalogViewSlice(...a),
        ...createCourseModalUISlice(...a),
        ...createUserSlice(...a),
        ...createThemeSlice(...a),
        ...createDimensionsSlice(...a),
        ...createGapiSlice(...a),
        ...createModalHistorySlice(...a),
        ...createProfileSlice(...a),
        ...createFerrySlice(...a),
        ...createSearchSlice(...a),
        ...createWorksheetSlice(...a),
      })),
    ),
    {
      name: 'store',
      partialize: (state) => pick(state, PersistKeys),
      merge: mergePersistedState,
    },
  ),
);

// Store init effects
export const useHydration = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubHydrate = useStore.persist.onHydrate(() => setHydrated(false));

    const unsubFinishHydration = useStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );

    setHydrated(useStore.persist.hasHydrated());

    return () => {
      unsubHydrate();
      unsubFinishHydration();
    };
  }, []);

  return hydrated;
};

const useAuth = () => {
  const refreshAuth = useStore((state) => state.refreshAuth);
  const loaded = useHydration();

  useEffect(() => {
    if (!loaded) return;
    void refreshAuth();
  }, [loaded, refreshAuth]);
};

const useDimensions = () => {
  const handleResize = useStore((state) => state.handleResize);

  useEffect(() => {
    handleResize();
    // The matchMedia queries fire exactly at breakpoint crossings, keeping the
    // JS breakpoint state in lockstep with the CSS media queries on resize.
    const queries = Object.values(breakpoints).map((width) =>
      window.matchMedia(`(min-width: ${width}px)`),
    );
    queries.forEach((query) => query.addEventListener('change', handleResize));
    return () => {
      queries.forEach((query) =>
        query.removeEventListener('change', handleResize),
      );
    };
  }, [handleResize]);
};

const useTheme = () => {
  const theme = useStore((state) => state.theme);

  const loaded = useHydration();

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.theme = theme;
    // We don't actually use this ourselves, but it helps Bootstrap apply sane
    // defaults for colors
    document.documentElement.dataset.bsTheme = theme;
  }, [theme, loaded]);
};

export const useInitStore = () => {
  useAuth();
  useDimensions();
  useTheme();
  useSavedWorksheetBootstrap();
  useWorksheetEffects();
};
