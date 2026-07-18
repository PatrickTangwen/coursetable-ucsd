import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import clsx from 'clsx';
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
import CalendarLockSettingsModal from '../components/Worksheet/CalendarLockSettingsModal';
import SunGridCalendar from '../components/Worksheet/SunGridCalendar';
import WorksheetCalendarSidebar from '../components/Worksheet/WorksheetCalendarSidebar';
import WorksheetList from '../components/Worksheet/WorksheetList';

import { CUR_SEASON } from '../config';
import {
  getInitialSavedWorksheetTerm,
  parseCoursesFromURL,
} from '../slices/WorksheetSlice';
import { useStore } from '../store';
import { parseAnonymousWorksheetShare } from '../utilities/anonymousWorksheet';
import styles from './Worksheet.module.css';

function Worksheet() {
  const {
    isMobile,
    worksheetLoading,
    worksheetError,
    worksheetView,
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
      viewAnonymousWorksheet ||
      savedWorksheetBootstrapStatus === 'loading' ||
      savedWorksheetBootstrapStatus === 'error'
    )
      return;

    if (activeSavedWorksheet && activeSavedWorksheetOwnerId === user.user_id)
      return;

    void ensureMainSavedWorksheetForTerm(getInitialSavedWorksheetTerm());
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

  // Mobile list view — term/worksheet switching lives in the navbar menu
  if (isListView && isMobile) return <WorksheetList />;

  // Calendar view (default)
  return (
    <div className={clsx(styles.pageBody, isMobile && styles.pageBodyMobile)}>
      <div className={styles.calendarZone}>
        {!isMobile && (
          <div className={styles.calendarControls}>
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="worksheet-fullscreen-tooltip">
                  {fullScreenLabel}
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
        <SunGridCalendar />
      </div>
      <div
        className={clsx(
          styles.sidebar,
          !isMobile && expanded && styles.sidebarCollapsed,
        )}
      >
        <WorksheetCalendarSidebar />
      </div>
      <CalendarLockSettingsModal />
    </div>
  );
}

export default Worksheet;
