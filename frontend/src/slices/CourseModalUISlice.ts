import type { StateCreator } from 'zustand';

import type { Store } from '../store';

export interface CourseModalUISliceState {
  courseModalActiveFamily: string | null;
  courseModalSelectedSections: { [family: string]: string | null };
  courseModalPrerequisitesExpanded: boolean;
}

export interface CourseModalUISliceActions {
  resetCourseModalUI: (
    activeFamily: string | null,
    selectedSections?: { [family: string]: string | null },
  ) => void;
  setCourseModalActiveFamily: (family: string) => void;
  selectCourseModalSection: (family: string, sectionCode: string) => void;
  toggleCourseModalPrerequisites: () => void;
  setCourseModalPrerequisitesExpanded: (expanded: boolean) => void;
}

export interface CourseModalUISlice
  extends CourseModalUISliceState, CourseModalUISliceActions {}

export const createCourseModalUISlice: StateCreator<
  Store,
  [],
  [],
  CourseModalUISlice
> = (set) => ({
  courseModalActiveFamily: null,
  courseModalSelectedSections: {},
  courseModalPrerequisitesExpanded: false,

  resetCourseModalUI: (activeFamily, selectedSections = {}) =>
    set({
      courseModalActiveFamily: activeFamily,
      courseModalSelectedSections: selectedSections,
      courseModalPrerequisitesExpanded: false,
    }),

  setCourseModalActiveFamily: (family) =>
    set({ courseModalActiveFamily: family }),

  selectCourseModalSection: (family, sectionCode) =>
    set((state) => ({
      courseModalActiveFamily: family,
      courseModalSelectedSections: {
        ...state.courseModalSelectedSections,
        [family]: sectionCode,
      },
    })),

  toggleCourseModalPrerequisites: () =>
    set((state) => ({
      courseModalPrerequisitesExpanded: !state.courseModalPrerequisitesExpanded,
    })),

  setCourseModalPrerequisitesExpanded: (expanded) =>
    set({ courseModalPrerequisitesExpanded: expanded }),
});
