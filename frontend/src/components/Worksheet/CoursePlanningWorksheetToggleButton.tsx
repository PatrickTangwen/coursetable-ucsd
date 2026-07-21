import { useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

import WorksheetConflictIcon from './WorksheetConflictIcon';
import {
  AddWorksheetButton,
  RemoveWorksheetButton,
} from './WorksheetToggleControls';
import { isWorksheetTerm } from '../../data/catalogSeasons';
import { useWorksheetListingSelection } from '../../hooks/useWorksheetListingSelection';
import type { CoursePlanningListing } from '../../queries/coursePlanningViewModels';
import type { Season } from '../../queries/graphql-types';
import { coursePlanningListingToWorksheetCourse } from '../../types/worksheetCourse';
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
    disabled,
    getRelevantWorksheetNumber,
    hasListing,
    hasSavedWorksheetAccount,
    toggleListing,
  } = useWorksheetListingSelection();
  const term = listing.section.supportedTerm as Season;
  const canEditWorksheet = isWorksheetTerm(term);
  const selectedWorksheet = getRelevantWorksheetNumber(term);
  const inWorksheet = hasListing(listing);
  const worksheetListing = useMemo(
    () =>
      coursePlanningListingToWorksheetCourse(listing, '#7B68EE', false).listing,
    [listing],
  );
  const buttonLabel = `${inWorksheet ? 'Remove from' : 'Add to'} ${
    hasSavedWorksheetAccount ? 'active Saved Worksheet' : 'worksheet'
  }`;
  const toggleWorksheet = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    await toggleListing(listing);
  };

  if (!canEditWorksheet) return null;

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
