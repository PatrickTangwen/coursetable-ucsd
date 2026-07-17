import { useMemo } from 'react';
import clsx from 'clsx';
import { Fade, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { MdErrorOutline } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import { useFerry, useWorksheetInfo } from '../../hooks/useFerry';
import { useStore } from '../../store';
import { checkConflict, type ListingWithTimes } from '../../utilities/course';
import { isPlannableTerm } from '../../utilities/termPlanning';
import styles from './WorksheetConflictIcon.module.css';

export type ListingWithHistoricalInfo = ListingWithTimes & {
  course: ListingWithTimes['course'] & {
    same_course_id?: number;
  };
};

export function useWorksheetConflictWarning({
  listing,
  inWorksheet,
  modal,
  worksheetNumber,
}: {
  readonly listing: ListingWithHistoricalInfo;
  readonly inWorksheet: boolean;
  readonly modal: boolean;
  readonly worksheetNumber: number;
}) {
  const { worksheets, isAnonymousWorksheet, activeSavedWorksheet, courses } =
    useStore(
      useShallow((state) => ({
        worksheets: state.worksheets,
        isAnonymousWorksheet:
          state.worksheetMemo.getIsAnonymousWorksheet(state),
        activeSavedWorksheet: state.activeSavedWorksheet,
        courses: state.courses,
      })),
    );

  const { data } = useWorksheetInfo(
    worksheets,
    listing.course.season_code,
    worksheetNumber,
  );
  const worksheetData =
    isAnonymousWorksheet || activeSavedWorksheet ? courses : data;
  const { courses: catalogData } = useFerry();
  const supportedTerms = useMemo(
    () =>
      Object.values(catalogData).flatMap(
        (catalog) => catalog.metadata.terms ?? [],
      ),
    [catalogData],
  );
  const termMetadata = useMemo(
    () =>
      supportedTerms.find((term) => term.term === listing.course.season_code),
    [listing.course.season_code, supportedTerms],
  );

  return useMemo(() => {
    if (inWorksheet) return undefined;
    if (modal) {
      if (!isPlannableTerm(termMetadata))
        return 'This will add to a worksheet of a semester that has already ended.';
      return undefined;
    }
    const conflicts = checkConflict(worksheetData, listing);
    if (conflicts.length > 0)
      return `Conflicts with: ${conflicts.map((x) => x.course_code).join(', ')}`;
    return undefined;
  }, [inWorksheet, modal, listing, termMetadata, worksheetData]);
}

export default function WorksheetConflictIcon({
  listing,
  inWorksheet,
  modal,
  mobile,
  worksheetNumber,
}: {
  readonly listing: ListingWithHistoricalInfo;
  readonly inWorksheet: boolean;
  readonly modal: boolean;
  readonly mobile?: boolean;
  readonly worksheetNumber: number;
}) {
  const warning = useWorksheetConflictWarning({
    listing,
    inWorksheet,
    modal,
    worksheetNumber,
  });

  return (
    <Fade in={Boolean(warning)}>
      <div
        className={clsx(
          styles.courseConflictIcon,
          modal && styles.modalCourseConflictIcon,
          mobile && styles.mobileCourseConflictIcon,
        )}
      >
        {warning && (
          <OverlayTrigger
            placement="top"
            popperConfig={{
              modifiers: [
                {
                  name: 'preventOverflow',
                  options: { padding: 8, altBoundary: true },
                },
              ],
            }}
            overlay={(props) => (
              <Tooltip
                {...props}
                id={`worksheet-toggle-conflict-${listing.crn}-tooltip`}
              >
                <small>{warning}</small>
              </Tooltip>
            )}
          >
            <button
              type="button"
              className={styles.conflictIconButton}
              aria-label={warning}
              onClick={(event) => event.stopPropagation()}
            >
              <MdErrorOutline
                color="#fc4103"
                size={modal ? 16 : 13}
                aria-hidden="true"
              />
            </button>
          </OverlayTrigger>
        )}
      </div>
    </Fade>
  );
}
