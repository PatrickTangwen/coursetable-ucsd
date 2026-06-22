import clsx from 'clsx';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { BsEyeSlash, BsEye } from 'react-icons/bs';
import { useShallow } from 'zustand/react/shallow';
import { isLegacyUserInfo, setCourseHidden } from '../../queries/api';
import type { Crn } from '../../queries/graphql-types';
import { useStore } from '../../store';
import styles from './WorksheetHideButton.module.css';

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
  const worksheetsRefresh = useStore((state) => state.worksheetsRefresh);
  const {
    viewedSeason,
    viewedWorksheetNumber,
    viewedPerson,
    isReadonlyWorksheet,
    isAnonymousWorksheet,
    courses,
    user,
    setAnonymousWorksheetListingHidden,
    setActiveSavedWorksheetListingHidden,
  } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
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
  const hasSavedWorksheetAccount = Boolean(user && !isLegacyUserInfo(user));
  if (isReadonlyWorksheet || viewedPerson !== 'me') return null;
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
          if (isAnonymousWorksheet) {
            const course = courses.find((c) => c.listing.crn === crn);
            if (course)
              setAnonymousWorksheetListingHidden(course.listing, !hidden);
            return;
          }
          if (hasSavedWorksheetAccount) {
            const course = courses.find((c) => c.listing.crn === crn);
            if (course) {
              await setActiveSavedWorksheetListingHidden(
                course.listing,
                !hidden,
              );
            }
            return;
          }
          await setCourseHidden({
            season: viewedSeason,
            worksheetNumber: viewedWorksheetNumber,
            crn,
            hidden: !hidden,
          });
          await worksheetsRefresh();
        }}
        className={clsx(styles.toggleButton, className)}
        aria-label={buttonLabel}
      >
        {hidden ? (
          <BsEyeSlash color="var(--color-hidden)" size={18} />
        ) : (
          <BsEye color={color} size={18} />
        )}
      </Button>
    </OverlayTrigger>
  );
}
