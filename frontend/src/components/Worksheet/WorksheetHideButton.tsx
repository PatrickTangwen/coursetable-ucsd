import clsx from 'clsx';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { BsEyeSlash, BsEye } from 'react-icons/bs';
import { useShallow } from 'zustand/react/shallow';
import type { Crn } from '../../queries/graphql-types';
import { useStore } from '../../store';
import styles from './WorksheetHideButton.module.css';

/**
 * Returns a callback that toggles a worksheet course's hidden flag, handling
 * anonymous and saved account modes. Returns null when the
 * viewed worksheet is not editable.
 */
export function useToggleCourseHidden():
  | ((crn: Crn, hidden: boolean) => Promise<void>)
  | null {
  const {
    viewedPerson,
    isReadonlyWorksheet,
    isAnonymousWorksheet,
    courses,
    user,
    setAnonymousWorksheetListingHidden,
    setActiveSavedWorksheetListingHidden,
  } = useStore(
    useShallow((state) => ({
      viewedPerson: state.viewedPerson,
      isReadonlyWorksheet: state.worksheetMemo.getIsReadonlyWorksheet(state),
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      courses: state.courses,
      user: state.user,
      setAnonymousWorksheetListingHidden:
        state.setAnonymousWorksheetListingHidden,
      setActiveSavedWorksheetListingHidden:
        state.setActiveSavedWorksheetListingHidden,
    })),
  );
  if (isReadonlyWorksheet || viewedPerson !== 'me') return null;
  if (!isAnonymousWorksheet && !user) return null;
  return async (crn: Crn, hidden: boolean) => {
    if (isAnonymousWorksheet) {
      const anonymousCourse = courses.find((c) => c.listing.crn === crn);
      if (anonymousCourse)
        setAnonymousWorksheetListingHidden(anonymousCourse.listing, !hidden);
      return;
    }
    const savedCourse = courses.find((c) => c.listing.crn === crn);
    if (savedCourse)
      await setActiveSavedWorksheetListingHidden(savedCourse.listing, !hidden);
  };
}

export default function WorksheetHideButton({
  hidden,
  crn,
  className,
  color,
  context = 'calendar',
}: {
  readonly hidden: boolean;
  readonly crn: Crn;
  readonly className?: string;
  readonly color?: string;
  readonly context?: 'calendar' | 'map';
}) {
  const toggleCourseHidden = useToggleCourseHidden();
  if (!toggleCourseHidden) return null;
  const buttonLabel =
    context === 'map'
      ? hidden
        ? 'Show on map'
        : 'Hide from map'
      : hidden
        ? 'Show in calendar'
        : 'Hide from calendar';
  return (
    <OverlayTrigger
      placement="bottom"
      overlay={(props) => (
        <Tooltip id={`worksheet-hide-button-${crn}-tooltip`} {...props}>
          <small>{buttonLabel}</small>
        </Tooltip>
      )}
    >
      <Button
        variant="toggle"
        onClick={async (e) => {
          // Prevent clicking hide button from opening course modal
          e.stopPropagation();
          await toggleCourseHidden(crn, hidden);
        }}
        className={clsx(styles.toggleButton, className)}
        aria-label={buttonLabel}
      >
        {hidden ? (
          <BsEyeSlash color="var(--color-hidden)" size={18} />
        ) : (
          <BsEye color={color ?? 'var(--color-text-dark)'} size={18} />
        )}
      </Button>
    </OverlayTrigger>
  );
}
