import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  FaLock,
  FaUnlock,
  FaCog,
  FaExpandAlt,
  FaCompressAlt,
} from 'react-icons/fa';
import { useShallow } from 'zustand/react/shallow';

import ErrorPage from '../components/ErrorPage';
import Spinner from '../components/Spinner';
import { SurfaceComponent } from '../components/Typography';
import CalendarLockSettingsModal from '../components/Worksheet/CalendarLockSettingsModal';
import SeasonDropdown from '../components/Worksheet/SeasonDropdown';
import WorksheetCalendar from '../components/Worksheet/WorksheetCalendar';
import WorksheetCalendarList from '../components/Worksheet/WorksheetCalendarList';
import WorksheetList from '../components/Worksheet/WorksheetList';
import WorksheetNumDropdown from '../components/Worksheet/WorksheetNumberDropdown';
import WorksheetStats from '../components/Worksheet/WorksheetStats';

import { CUR_SEASON } from '../config';
import { isLegacyUserInfo } from '../queries/api';
import { parseCoursesFromURL } from '../slices/WorksheetSlice';
import { useStore } from '../store';
import { parseAnonymousWorksheetShare } from '../utilities/anonymousWorksheet';
import styles from './Worksheet.module.css';

function Worksheet() {
  const {
    isMobile,
    worksheetLoading,
    worksheetError,
    worksheetView,
    isExoticWorksheet,
    isAnonymousWorksheet,
    isCalendarViewLocked,
    authStatus,
    user,
    viewAnonymousWorksheet,
    activeSavedWorksheet,
    activeSavedWorksheetOwnerId,
    savedWorksheetBootstrapStatus,
    ensureMainSavedWorksheetForTerm,
    setCalendarViewLocked,
    setCalendarLockSettingsOpen,
  } = useStore(
    useShallow((state) => ({
      isMobile: state.isMobile,
      worksheetLoading: state.worksheetLoading,
      worksheetError: state.worksheetError,
      worksheetView: state.worksheetView,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      isCalendarViewLocked: state.isCalendarViewLocked,
      authStatus: state.authStatus,
      user: state.user,
      viewAnonymousWorksheet: state.viewAnonymousWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeSavedWorksheetOwnerId: state.activeSavedWorksheetOwnerId,
      savedWorksheetBootstrapStatus: state.savedWorksheetBootstrapStatus,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      setCalendarViewLocked: state.setCalendarViewLocked,
      setCalendarLockSettingsOpen: state.setCalendarLockSettingsOpen,
    })),
  );
  const [expanded, setExpanded] = useState(false);
  const emptyMissingBuildingCodes = useMemo(() => new Set<string>(), []);
  const skipAccountBootstrapRef = useRef(
    typeof window !== 'undefined' &&
      (() => {
        const searchParams = new URLSearchParams(window.location.search);
        return (
          searchParams.has('ws') ||
          (searchParams.has('t') && searchParams.has('sections'))
        );
      })(),
  );

  useEffect(() => {
    const exoticWorksheet = parseCoursesFromURL();
    const searchParams = new URLSearchParams(window.location.search);
    const anonymousShare = parseAnonymousWorksheetShare(
      searchParams,
      CUR_SEASON,
    );
    if (anonymousShare) {
      useStore.getState().restoreAnonymousWorksheetFromShare(anonymousShare);
      searchParams.delete('t');
      searchParams.delete('sections');
      const nextSearch = searchParams.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
      );
    }
    useStore.setState({ exoticWorksheet });
  }, []);

  useEffect(() => {
    if (
      skipAccountBootstrapRef.current ||
      authStatus !== 'authenticated' ||
      !user ||
      isLegacyUserInfo(user) ||
      viewAnonymousWorksheet ||
      savedWorksheetBootstrapStatus === 'loading' ||
      savedWorksheetBootstrapStatus === 'error'
    )
      return;

    const hasCurrentUserMainWorksheet =
      activeSavedWorksheet?.term === CUR_SEASON &&
      activeSavedWorksheetOwnerId === user.user_id;
    if (hasCurrentUserMainWorksheet) return;

    void ensureMainSavedWorksheetForTerm(CUR_SEASON);
  }, [
    activeSavedWorksheet,
    activeSavedWorksheetOwnerId,
    authStatus,
    ensureMainSavedWorksheetForTerm,
    savedWorksheetBootstrapStatus,
    user,
    viewAnonymousWorksheet,
  ]);

  // Wait for search query to finish
  if (worksheetError) {
    Sentry.captureException(worksheetError);
    return <ErrorPage message="There seems to be an issue with our server" />;
  }
  if (worksheetLoading) return <Spinner message="Loading worksheet data..." />;
  const isListView = worksheetView === 'list';
  if (isListView && !isMobile) return <WorksheetList />;
  const LockIcon = isCalendarViewLocked ? FaLock : FaUnlock;
  const lockLabel = isCalendarViewLocked ? 'Unlock view' : 'Lock view';

  const FullScreenIcon = expanded ? FaCompressAlt : FaExpandAlt;
  const fullScreenLabel = expanded ? 'Compress calendar' : 'Expand calendar';

  // Mobile list view - show dropdowns and list
  if (isListView && isMobile) {
    return (
      <>
        {!isExoticWorksheet && (
          <div className={styles.mobileListDropdowns}>
            {!isAnonymousWorksheet && <WorksheetNumDropdown mobile />}
            <SeasonDropdown mobile />
          </div>
        )}
        <WorksheetList />
      </>
    );
  }

  // Calendar view (default)
  return (
    <div className={styles.container}>
      {isMobile && !isExoticWorksheet && (
        <div className={styles.dropdowns}>
          {!isAnonymousWorksheet && <WorksheetNumDropdown mobile />}
          <SeasonDropdown mobile />
        </div>
      )}
      <SurfaceComponent className={styles.calendar}>
        <WorksheetCalendar showWalkingTimes={false} />
        {!isMobile && (
          <div className={styles.calendarControls}>
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="worksheet-fullscreen-tooltip">
                  {fullScreenLabel} + new buttons! (beta)
                </Tooltip>
              }
            >
              <button
                type="button"
                className={styles.controlsTrigger}
                onClick={() => setExpanded((x) => !x)}
                aria-label={fullScreenLabel}
              >
                <FullScreenIcon className={styles.triggerIcon} size={11} />
                <span className={styles.betaIndicator} aria-hidden="true" />
              </button>
            </OverlayTrigger>

            <div className={styles.controlsMenu}>
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() => setCalendarViewLocked(!isCalendarViewLocked)}
                aria-label={lockLabel}
                title={lockLabel}
              >
                <LockIcon size={11} />
              </button>

              <button
                type="button"
                className={styles.controlBtn}
                onClick={() => setCalendarLockSettingsOpen(true)}
                aria-label="Calendar time range settings"
                title="Calendar time range settings"
              >
                <FaCog size={11} />
              </button>
            </div>
          </div>
        )}
      </SurfaceComponent>
      {(isMobile || !expanded) && (
        <div className={styles.calendarSidebar}>
          <WorksheetStats />
          <WorksheetCalendarList
            highlightBuilding={null}
            showLocation={false}
            showMissingLocationIcon={false}
            controlsMode="full"
            missingBuildingCodes={emptyMissingBuildingCodes}
            hideTooltipContext="calendar"
          />
        </div>
      )}
      <CalendarLockSettingsModal />
    </div>
  );
}

export default Worksheet;
