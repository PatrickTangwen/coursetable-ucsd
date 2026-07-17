import { useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import WorksheetConflictIcon from './WorksheetConflictIcon';
import {
  AddWorksheetButton,
  RemoveWorksheetButton,
} from './WorksheetToggleControls';
import { isLegacyUserInfo } from '../../queries/api';
import type { CoursePlanningListing } from '../../queries/coursePlanningViewModels';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import { coursePlanningListingToWorksheetCourse } from '../../types/worksheetCourse';
import { anonymousWorksheetHasListing } from '../../utilities/anonymousWorksheet';
import { worksheetColors } from '../../utilities/constants';
import styles from './CoursePlanningWorksheetToggleButton.module.css';

export default function CoursePlanningWorksheetToggleButton({
  listing,
  modal,
  appearance = 'icon',
  className,
  showConflictIcon = true,
}: {
  readonly listing: CoursePlanningListing;
  readonly modal: boolean;
  readonly appearance?: 'icon' | 'mobile' | 'remove';
  readonly className?: string;
  readonly showConflictIcon?: boolean;
}) {
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
  const hasSavedWorksheetAccount = Boolean(user && !isLegacyUserInfo(user));
  const term = listing.section.supportedTerm as Season;
  const { sectionId } = listing.section;
  const selectedWorksheet = getRelevantWorksheetNumber(term);
  const inWorksheet = isAnonymousWorksheet
    ? anonymousWorksheetHasListing(anonymousWorksheet, listing)
    : activeSavedWorksheet && term !== activeSavedWorksheet.term
      ? (crossTermSavedSections[term]?.some(
          (section) => section.sectionId === sectionId,
        ) ?? false)
      : (activeSavedWorksheet?.sections.some(
          (section) => section.sectionId === sectionId,
        ) ?? false);
  const worksheetListing = useMemo(
    () =>
      coursePlanningListingToWorksheetCourse(listing, '#7B68EE', false).listing,
    [listing],
  );
  const buttonLabel = `${inWorksheet ? 'Remove from' : 'Add to'} ${
    hasSavedWorksheetAccount ? 'active Saved Worksheet' : 'worksheet'
  }`;
  const disabled = hasSavedWorksheetAccount && !activeSavedWorksheet;

  const toggleWorksheet = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const color =
      worksheetColors[Math.floor(Math.random() * worksheetColors.length)]!;
    const changed = hasSavedWorksheetAccount
      ? inWorksheet
        ? await removeActiveSavedWorksheetListing(listing)
        : await addActiveSavedWorksheetListing(listing, color)
      : inWorksheet
        ? removeAnonymousWorksheetListing(listing)
        : addAnonymousWorksheetListing(listing, color);
    if (!changed) return;
    toast.success(
      inWorksheet
        ? 'Removed from worksheet'
        : `Added ${listing.course.courseCode} to worksheet`,
      { duration: 800 },
    );
  };

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
            listing={worksheetListing}
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
            <Tooltip
              id={`worksheet-toggle-${worksheetListing.crn}-tooltip`}
              {...props}
            >
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
