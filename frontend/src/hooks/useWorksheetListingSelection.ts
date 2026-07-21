import { useCallback } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { useStore } from '../store';
import {
  anonymousWorksheetHasListing,
  getAnonymousWorksheetCourses,
} from '../utilities/anonymousWorksheet';
import { getNextWorksheetColor } from '../utilities/constants';
import { savedWorksheetHasListing } from '../utilities/savedWorksheet';

const toastDuration = 800;

export function useWorksheetListingSelection() {
  const {
    activeSavedWorksheet,
    addActiveSavedWorksheetListing,
    addAnonymousWorksheetListing,
    anonymousWorksheet,
    crossTermSavedSections,
    getRelevantWorksheetNumber,
    isAnonymousWorksheet,
    removeActiveSavedWorksheetListing,
    removeAnonymousWorksheetListing,
    user,
  } = useStore(
    useShallow((state) => ({
      activeSavedWorksheet: state.activeSavedWorksheet,
      addActiveSavedWorksheetListing: state.addActiveSavedWorksheetListing,
      addAnonymousWorksheetListing: state.addAnonymousWorksheetListing,
      anonymousWorksheet: state.anonymousWorksheet,
      crossTermSavedSections: state.crossTermSavedSections,
      getRelevantWorksheetNumber: state.getRelevantWorksheetNumber,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      removeActiveSavedWorksheetListing:
        state.removeActiveSavedWorksheetListing,
      removeAnonymousWorksheetListing: state.removeAnonymousWorksheetListing,
      user: state.user,
    })),
  );
  const hasSavedWorksheetAccount = Boolean(user);

  const hasListing = useCallback(
    (listing: CoursePlanningListing) =>
      isAnonymousWorksheet
        ? anonymousWorksheetHasListing(anonymousWorksheet, listing)
        : savedWorksheetHasListing(
            activeSavedWorksheet,
            crossTermSavedSections,
            listing,
          ),
    [
      activeSavedWorksheet,
      anonymousWorksheet,
      crossTermSavedSections,
      isAnonymousWorksheet,
    ],
  );

  const toggleListing = useCallback(
    async (listing: CoursePlanningListing) => {
      const term = listing.section.supportedTerm as Season;
      const inWorksheet = hasListing(listing);
      const worksheetSections = isAnonymousWorksheet
        ? getAnonymousWorksheetCourses(anonymousWorksheet, term)
        : term === activeSavedWorksheet?.term
          ? activeSavedWorksheet.sections
          : (crossTermSavedSections[term] ?? []);
      const color = getNextWorksheetColor(
        worksheetSections.map((section) => section.color),
      );
      const changed = hasSavedWorksheetAccount
        ? inWorksheet
          ? await removeActiveSavedWorksheetListing(listing)
          : await addActiveSavedWorksheetListing(listing, color)
        : inWorksheet
          ? removeAnonymousWorksheetListing(listing)
          : addAnonymousWorksheetListing(listing, color);
      if (!changed) return false;
      toast.success(
        inWorksheet
          ? 'Removed from worksheet'
          : `Added ${listing.course.courseCode} to worksheet`,
        { duration: toastDuration },
      );
      return true;
    },
    [
      activeSavedWorksheet,
      addActiveSavedWorksheetListing,
      addAnonymousWorksheetListing,
      anonymousWorksheet,
      crossTermSavedSections,
      hasListing,
      hasSavedWorksheetAccount,
      isAnonymousWorksheet,
      removeActiveSavedWorksheetListing,
      removeAnonymousWorksheetListing,
    ],
  );

  return {
    disabled: hasSavedWorksheetAccount && !activeSavedWorksheet,
    getRelevantWorksheetNumber,
    hasListing,
    hasSavedWorksheetAccount,
    toggleListing,
  };
}
