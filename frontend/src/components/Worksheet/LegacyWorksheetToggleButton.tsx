import { useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import WorksheetConflictIcon, {
  type ListingWithHistoricalInfo,
} from './WorksheetConflictIcon';
import {
  AddWorksheetButton,
  RemoveWorksheetButton,
} from './WorksheetToggleControls';
import { useStore } from '../../store';
import {
  anonymousWorksheetHasListing,
  getListingSectionId,
} from '../../utilities/anonymousWorksheet';
import { worksheetColors } from '../../utilities/constants';
import styles from './WorksheetToggleButton.module.css';

export type { ListingWithHistoricalInfo } from './WorksheetConflictIcon';

export function useWorksheetListingPresence(
  listing: ListingWithHistoricalInfo,
  inWorksheetProp?: boolean,
) {
  const {
    anonymousWorksheet,
    isAnonymousWorksheet,
    activeSavedWorksheet,
    crossTermSavedSections,
    user,
  } = useStore(
    useShallow((state) => ({
      anonymousWorksheet: state.anonymousWorksheet,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      activeSavedWorksheet: state.activeSavedWorksheet,
      crossTermSavedSections: state.crossTermSavedSections,
      user: state.user,
    })),
  );

  return useMemo(() => {
    if (isAnonymousWorksheet)
      return anonymousWorksheetHasListing(anonymousWorksheet, listing);
    if (!user) return inWorksheetProp ?? false;

    const sectionId = getListingSectionId(listing);
    if (!sectionId) return false;
    const listingTerm = listing.course.season_code;
    if (
      activeSavedWorksheet &&
      listingTerm &&
      listingTerm !== activeSavedWorksheet.term
    ) {
      const crossSections = crossTermSavedSections[listingTerm];
      return (
        crossSections?.some((section) => section.sectionId === sectionId) ??
        false
      );
    }
    return Boolean(
      activeSavedWorksheet?.sections.some(
        (section) => section.sectionId === sectionId,
      ),
    );
  }, [
    activeSavedWorksheet,
    anonymousWorksheet,
    crossTermSavedSections,
    inWorksheetProp,
    isAnonymousWorksheet,
    listing,
    user,
  ]);
}

export { useWorksheetConflictWarning } from './WorksheetConflictIcon';

/**
 * Worksheet toggle for inherited GraphQL listing data at the current app seam.
 */
function LegacyWorksheetToggleButton({
  listing,
  modal,
  inWorksheet: inWorksheetProp,
  appearance = 'icon',
  className,
  showConflictIcon = true,
}: {
  readonly listing: ListingWithHistoricalInfo;
  readonly modal: boolean;
  readonly inWorksheet?: boolean;
  readonly appearance?: 'icon' | 'mobile' | 'remove';
  readonly className?: string;
  readonly showConflictIcon?: boolean;
}) {
  const {
    isAnonymousWorksheet,
    activeSavedWorksheet,
    crossTermSavedSections,
    allTermSavedWorksheetSummaries,
    loadSavedWorksheetSectionsForTerm,
    addAnonymousWorksheetListing,
    removeAnonymousWorksheetListing,
    addActiveSavedWorksheetListing,
    removeActiveSavedWorksheetListing,
    getRelevantWorksheetNumber,
    user,
  } = useStore(
    useShallow((state) => ({
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      activeSavedWorksheet: state.activeSavedWorksheet,
      crossTermSavedSections: state.crossTermSavedSections,
      allTermSavedWorksheetSummaries: state.allTermSavedWorksheetSummaries,
      loadSavedWorksheetSectionsForTerm:
        state.loadSavedWorksheetSectionsForTerm,
      addAnonymousWorksheetListing: state.addAnonymousWorksheetListing,
      removeAnonymousWorksheetListing: state.removeAnonymousWorksheetListing,
      addActiveSavedWorksheetListing: state.addActiveSavedWorksheetListing,
      removeActiveSavedWorksheetListing:
        state.removeActiveSavedWorksheetListing,
      getRelevantWorksheetNumber: state.getRelevantWorksheetNumber,
      user: state.user,
    })),
  );
  const hasSavedWorksheetAccount = Boolean(user);
  const selectedWorksheet = getRelevantWorksheetNumber(
    listing.course.season_code,
  );
  const inWorksheet = useWorksheetListingPresence(listing, inWorksheetProp);

  useEffect(() => {
    if (!hasSavedWorksheetAccount || !activeSavedWorksheet) return;
    const listingTerm = listing.course.season_code;
    if (!listingTerm || listingTerm === activeSavedWorksheet.term) return;
    if (Object.hasOwn(crossTermSavedSections, listingTerm)) return;

    void loadSavedWorksheetSectionsForTerm(listingTerm);
  }, [
    activeSavedWorksheet,
    allTermSavedWorksheetSummaries,
    crossTermSavedSections,
    hasSavedWorksheetAccount,
    listing.course.season_code,
    loadSavedWorksheetSectionsForTerm,
  ]);

  const toggleWorksheet = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (isAnonymousWorksheet) {
      if (!getListingSectionId(listing)) {
        toast.error('This section cannot be added to this worksheet.');
        return;
      }
      const anonymousChanged = inWorksheet
        ? removeAnonymousWorksheetListing(listing)
        : addAnonymousWorksheetListing(
            listing,
            worksheetColors[
              Math.floor(Math.random() * worksheetColors.length)
            ]!,
          );
      if (anonymousChanged) {
        toast.success(
          inWorksheet
            ? 'Removed from worksheet'
            : `Added ${listing.course_code ?? 'section'} to worksheet`,
          { duration: 800 },
        );
      }
      return;
    }

    if (!hasSavedWorksheetAccount || !activeSavedWorksheet) return;
    const color =
      worksheetColors[Math.floor(Math.random() * worksheetColors.length)]!;
    const savedChanged = inWorksheet
      ? await removeActiveSavedWorksheetListing(listing)
      : await addActiveSavedWorksheetListing(listing, color);
    if (savedChanged) {
      toast.success(
        inWorksheet
          ? 'Removed from Saved Worksheet'
          : 'Added to Saved Worksheet',
        { duration: 800 },
      );
    }
  };

  const buttonLabel = isAnonymousWorksheet
    ? `${inWorksheet ? 'Remove from' : 'Add to'} worksheet`
    : hasSavedWorksheetAccount
      ? `${inWorksheet ? 'Remove from' : 'Add to'} active Saved Worksheet`
      : 'Log in to add to your worksheet';
  const disabled =
    (!isAnonymousWorksheet && !hasSavedWorksheetAccount) ||
    (hasSavedWorksheetAccount && !activeSavedWorksheet);

  if (appearance === 'remove') {
    return (
      <RemoveWorksheetButton
        className={className}
        onClick={(event) => {
          toggleWorksheet(event).catch((error: unknown) =>
            Sentry.captureException(error),
          );
        }}
        disabled={disabled || !inWorksheet}
        ariaLabel={buttonLabel}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toggleContainer}>
        {showConflictIcon && (
          <WorksheetConflictIcon
            listing={listing}
            inWorksheet={inWorksheet}
            modal={modal}
            mobile={appearance === 'mobile'}
            worksheetNumber={selectedWorksheet}
          />
        )}
        <OverlayTrigger
          placement="top"
          delay={modal ? { show: 300, hide: 0 } : undefined}
          overlay={(props) => (
            <Tooltip id={`worksheet-toggle-${listing.crn}-tooltip`} {...props}>
              <small>{buttonLabel}</small>
            </Tooltip>
          )}
        >
          <AddWorksheetButton
            className="p-0"
            added={inWorksheet}
            onClick={(event) => {
              toggleWorksheet(event).catch((error: unknown) =>
                Sentry.captureException(error),
              );
            }}
            ariaLabel={buttonLabel}
            disabled={disabled}
            mobile={appearance === 'mobile'}
          />
        </OverlayTrigger>
      </div>
    </div>
  );
}

export default LegacyWorksheetToggleButton;
