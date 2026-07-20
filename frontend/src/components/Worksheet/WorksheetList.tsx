import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from 'react-bootstrap';
import { useShallow } from 'zustand/react/shallow';

import ConflictModal from './ConflictModal';
import ExamsModal from './ExamsModal';
import { useICSExport } from './ICSExportButton';
import { useWorksheetSeasonCodes } from './SeasonDropdown';
import { useWorksheetURLExport } from './URLExportButton';
import WeeklyLoadChart from './WeeklyLoadChart';
import {
  getAnonymousWorksheetTermChips,
  getSavedWorksheetTermChips,
} from './WorksheetCalendarList';
import {
  type WorksheetControlsMenu,
  WorksheetColorSheet,
  WorksheetVisibilityMenuButton,
} from './WorksheetCourseMenus';
import {
  busiestDay,
  creditLoad,
  firstExam,
  hasAnyExam,
} from './worksheetInsights';
import WorksheetListItem from './WorksheetListItem';
import { worksheetExportMenuCopy } from './worksheetMenuCopy';
import type { SavedWorksheetSection } from '../../queries/api';
import type { Crn } from '../../queries/graphql-types';
import { useStore } from '../../store';
import {
  getAnonymousWorksheetCourses,
  type AnonymousWorksheetCourse,
} from '../../utilities/anonymousWorksheet';
import {
  getWorksheetCourseStats,
  toSeasonString,
} from '../../utilities/course';
import {
  getScheduleConflicts,
  groupConflictsByCrn,
} from '../../utilities/scheduleConflicts';
import NoCourses from '../Search/NoCourses';
import styles from './WorksheetList.module.css';

type ClearedSnapshot =
  | { kind: 'saved'; sections: SavedWorksheetSection[] }
  | { kind: 'anonymous'; courses: AnonymousWorksheetCourse[] };

function ExpandAllIcon({ allExpanded }: { readonly allExpanded: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {allExpanded ? (
        <>
          <polyline points="7 9 12 4 17 9" />
          <polyline points="7 15 12 20 17 15" />
        </>
      ) : (
        <>
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </>
      )}
    </svg>
  );
}

function WorksheetExportMenu({ onClose }: { readonly onClose: () => void }) {
  const ics = useICSExport();
  const exportURL = useWorksheetURLExport();
  return (
    <>
      <button
        type="button"
        className={styles.menuBackdrop}
        onClick={onClose}
        aria-label="Close export menu"
        tabIndex={-1}
      />
      <div className={styles.exportMenu} role="menu">
        <a
          role="menuitem"
          className={styles.exportMenuItem}
          href={ics.href}
          download={ics.download}
          onClick={(event) => {
            ics.onClick(event);
            onClose();
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {worksheetExportMenuCopy.ics}
        </a>
        <button
          type="button"
          role="menuitem"
          className={styles.exportMenuItem}
          onClick={() => {
            void exportURL();
            onClose();
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {worksheetExportMenuCopy.share}
        </button>
      </div>
    </>
  );
}

function WorksheetList() {
  const {
    courses,
    viewedSeason,
    viewedWorksheetNumber,
    viewedWorksheetName,
    isReadonlyWorksheet,
    isExoticWorksheet,
    exoticWorksheet,
    viewedPerson,
    friends,
    user,
    isAnonymousWorksheet,
    anonymousWorksheet,
    worksheetMissingSectionIds,
    isMobile,
    changeViewedSeason,
    clearAnonymousWorksheet,
    clearActiveSavedWorksheet,
    restoreAnonymousWorksheetCourses,
    restoreActiveSavedWorksheetSections,
    hideConflictWarnings,
    setHideConflictWarnings,
    activeSavedWorksheet,
    activeSavedWorksheetIdsByTerm,
    allTermSavedWorksheetSummaries,
    ensureMainSavedWorksheetForTerm,
    exitExoticWorksheet,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
      viewedWorksheetName: state.worksheetMemo.getViewedWorksheetName(state),
      isReadonlyWorksheet: state.worksheetMemo.getIsReadonlyWorksheet(state),
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exoticWorksheet: state.exoticWorksheet,
      viewedPerson: state.viewedPerson,
      friends: state.friends,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      worksheetMissingSectionIds: state.worksheetMissingSectionIds,
      isMobile: state.isMobile,
      changeViewedSeason: state.changeViewedSeason,
      clearAnonymousWorksheet: state.clearAnonymousWorksheet,
      clearActiveSavedWorksheet: state.clearActiveSavedWorksheet,
      restoreAnonymousWorksheetCourses: state.restoreAnonymousWorksheetCourses,
      restoreActiveSavedWorksheetSections:
        state.restoreActiveSavedWorksheetSections,
      hideConflictWarnings: state.hideConflictWarnings,
      setHideConflictWarnings: state.setHideConflictWarnings,
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeSavedWorksheetIdsByTerm: state.activeSavedWorksheetIdsByTerm,
      allTermSavedWorksheetSummaries: state.allTermSavedWorksheetSummaries,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      exitExoticWorksheet: state.exitExoticWorksheet,
    })),
  );
  const seasonCodes = useWorksheetSeasonCodes();

  const [expandedCrns, setExpandedCrns] = useState<ReadonlySet<Crn>>(new Set());
  const [openControlsMenu, setOpenControlsMenu] =
    useState<WorksheetControlsMenu>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [examsModalOpen, setExamsModalOpen] = useState(false);
  const [openColorMenuCrn, setOpenColorMenuCrn] = useState<Crn | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearedSnapshot, setClearedSnapshot] =
    useState<ClearedSnapshot | null>(null);

  const visibilityMenuOpen = openControlsMenu === 'visibility';
  const exportMenuOpen = openControlsMenu === 'export';
  const settingsMenuOpen = openControlsMenu === 'settings';
  const changeControlsMenu = (nextMenu: WorksheetControlsMenu) => {
    if (nextMenu !== 'settings') setConfirmClear(false);
    setOpenControlsMenu(nextMenu);
  };

  const closeSettingsMenu = () => {
    changeControlsMenu(null);
  };

  // A cleared-courses snapshot only makes sense for the worksheet it came
  // from; switching term or worksheet discards it.
  const worksheetKey = `${viewedSeason}|${activeSavedWorksheet?.id ?? ''}|${viewedWorksheetNumber}`;
  useEffect(() => {
    setExpandedCrns(new Set());
    setClearedSnapshot(null);
    setConfirmClear(false);
    setOpenControlsMenu(null);
    setOpenColorMenuCrn(null);
  }, [worksheetKey]);

  const hasSavedWorksheetAccount = Boolean(user);
  const canMutateCurrentWorksheet =
    isAnonymousWorksheet || hasSavedWorksheetAccount;

  const visibleCourses = useMemo(
    () => courses.filter((course) => !course.hidden),
    [courses],
  );
  const { courseCount, credits } = getWorksheetCourseStats(visibleCourses);
  const load = creditLoad(credits);
  const allExpanded =
    visibleCourses.length > 0 &&
    visibleCourses.every((course) => expandedCrns.has(course.crn));

  const exam = useMemo(() => firstExam(visibleCourses), [visibleCourses]);
  const anyExam = useMemo(() => hasAnyExam(visibleCourses), [visibleCourses]);
  const busiest = useMemo(() => busiestDay(visibleCourses), [visibleCourses]);
  const scheduleConflicts = useMemo(
    () => getScheduleConflicts(visibleCourses),
    [visibleCourses],
  );
  const conflictsByCrn = useMemo(
    () => groupConflictsByCrn(scheduleConflicts),
    [scheduleConflicts],
  );

  const anonymousEmptyTermChips = useMemo(
    () =>
      isAnonymousWorksheet && courses.length === 0
        ? getAnonymousWorksheetTermChips(
            anonymousWorksheet,
            seasonCodes,
            viewedSeason,
          )
        : [],
    [
      anonymousWorksheet,
      courses.length,
      isAnonymousWorksheet,
      seasonCodes,
      viewedSeason,
    ],
  );

  const savedWorksheetEmptyTermChips = useMemo(
    () =>
      !isAnonymousWorksheet &&
      activeSavedWorksheet &&
      courses.length === 0 &&
      allTermSavedWorksheetSummaries.length > 0
        ? getSavedWorksheetTermChips(
            allTermSavedWorksheetSummaries,
            activeSavedWorksheetIdsByTerm,
            activeSavedWorksheet.term,
          )
        : [],
    [
      activeSavedWorksheet,
      activeSavedWorksheetIdsByTerm,
      allTermSavedWorksheetSummaries,
      courses.length,
      isAnonymousWorksheet,
    ],
  );

  const showHideButton = canMutateCurrentWorksheet && !isReadonlyWorksheet;
  const showSettings =
    canMutateCurrentWorksheet &&
    !isExoticWorksheet &&
    viewedPerson === 'me' &&
    // Keep the menu reachable right after clearing an anonymous worksheet so
    // "Restore all courses" stays available.
    (!isAnonymousWorksheet || courses.length > 0 || clearedSnapshot !== null);
  const importSeason = exoticWorksheet?.data.season ?? viewedSeason;

  const pageTitle = isExoticWorksheet
    ? (exoticWorksheet?.data.name ?? 'Shared Worksheet')
    : viewedPerson === 'me'
      ? 'My Worksheet'
      : `${friends?.[viewedPerson]?.name ?? viewedPerson}'s Worksheet`;
  const pageSubtitleParts = isExoticWorksheet
    ? [
        toSeasonString(importSeason),
        exoticWorksheet?.data.creatorName
          ? `by ${exoticWorksheet.data.creatorName}`
          : '',
      ]
    : [toSeasonString(viewedSeason), viewedWorksheetName];
  const pageSubtitle = pageSubtitleParts.filter(Boolean).join(' · ');

  const toggleAllExpand = () => {
    setExpandedCrns(
      allExpanded
        ? new Set()
        : new Set(visibleCourses.map((course) => course.crn)),
    );
  };

  const toggleOneExpand = (crn: Crn) => {
    setExpandedCrns((previous) => {
      const next = new Set(previous);
      if (next.has(crn)) next.delete(crn);
      else next.add(crn);
      return next;
    });
  };

  const handleClearAll = async () => {
    if (courses.length === 0) return;

    if (isAnonymousWorksheet) {
      const anonymousSnapshot = getAnonymousWorksheetCourses(
        anonymousWorksheet,
        viewedSeason,
      );
      clearAnonymousWorksheet();
      setClearedSnapshot({ kind: 'anonymous', courses: anonymousSnapshot });
      closeSettingsMenu();
      return;
    }

    if (hasSavedWorksheetAccount) {
      const sections = activeSavedWorksheet?.sections ?? [];
      setClearing(true);
      try {
        const cleared = await clearActiveSavedWorksheet();
        if (cleared) {
          setClearedSnapshot({ kind: 'saved', sections });
          closeSettingsMenu();
        }
      } finally {
        setClearing(false);
      }
    }
  };

  const handleRestoreAll = async () => {
    if (!clearedSnapshot) return;
    if (clearedSnapshot.kind === 'anonymous')
      restoreAnonymousWorksheetCourses(clearedSnapshot.courses);
    else await restoreActiveSavedWorksheetSections(clearedSnapshot.sections);
    setClearedSnapshot(null);
    closeSettingsMenu();
  };

  const warnings: string[] = [];
  if (worksheetMissingSectionIds.length > 0) {
    warnings.push(
      `${worksheetMissingSectionIds.length} ${
        isAnonymousWorksheet ? 'shared' : 'saved'
      } section${worksheetMissingSectionIds.length === 1 ? '' : 's'} no longer available in this snapshot.`,
    );
  }

  return (
    <div className={styles.page}>
      {(isExoticWorksheet || viewedPerson !== 'me') && (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            <p className={styles.pageSubtitle}>{pageSubtitle}</p>
          </div>
          {isExoticWorksheet && isMobile && (
            <Button variant="primary" size="sm" onClick={exitExoticWorksheet}>
              Exit
            </Button>
          )}
        </div>
      )}

      {courses.length > 0 ? (
        <div className={styles.mainRow}>
          <div className={styles.sidebar}>
            <div className={styles.dashboardGrid}>
              <div className={styles.dashTile}>
                <div className={styles.dashLabel}>Courses</div>
                <div className={styles.dashValue}>{courseCount}</div>
                <div className={styles.dashSub}>planned</div>
              </div>
              <div className={styles.dashTile}>
                <div className={styles.dashLabel}>Credits</div>
                <div className={styles.dashValue}>{credits}</div>
                <div className={styles.dashLoad}>
                  <span
                    className={styles.loadDot}
                    style={{ background: load.color }}
                    aria-hidden="true"
                  />
                  {load.label}
                </div>
              </div>
              {scheduleConflicts.length > 0 ? (
                <button
                  type="button"
                  className={styles.conflictTile}
                  data-muted={hideConflictWarnings || undefined}
                  onClick={() => setConflictModalOpen(true)}
                >
                  {!hideConflictWarnings && (
                    <span
                      className={styles.conflictPulseDot}
                      aria-hidden="true"
                    />
                  )}
                  <div className={styles.dashLabel}>Conflicts</div>
                  <div className={styles.dashValue}>
                    {scheduleConflicts.length}
                  </div>
                  <div className={styles.conflictTileView}>
                    {hideConflictWarnings ? 'warnings hidden' : 'View'}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className={styles.dashTile}>
                  <div className={styles.dashLabel}>Conflicts</div>
                  <div className={styles.dashValue}>0</div>
                  <div className={styles.dashClear}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--ct-green-icon)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    all clear
                  </div>
                </div>
              )}
            </div>

            <div className={styles.infoGrid}>
              {anyExam ? (
                <button
                  type="button"
                  className={styles.examTileButton}
                  onClick={() => setExamsModalOpen(true)}
                >
                  <div className={styles.infoLabel}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Exam
                  </div>
                  <div className={styles.infoValue}>
                    {exam ? exam.countdown : '—'}
                  </div>
                  <div className={styles.infoSubRow}>
                    First · {exam ? exam.dateShort : '—'}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className={styles.infoTile}>
                  <div className={styles.infoLabel}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Exam
                  </div>
                  <div className={styles.infoValue}>—</div>
                  <div className={styles.infoSub}>First · —</div>
                </div>
              )}
              <div className={styles.infoTile}>
                <div className={styles.infoLabel}>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  Busiest day
                </div>
                <div className={styles.infoValue}>
                  {busiest ? busiest.label : '—'}
                </div>
                <div className={styles.infoSub}>
                  {busiest
                    ? `${busiest.count} ${busiest.count === 1 ? 'class' : 'classes'}`
                    : 'No weekly classes'}
                </div>
              </div>
            </div>

            <div className={styles.controls}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={toggleAllExpand}
                title={allExpanded ? 'Collapse all' : 'Expand all'}
                aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
              >
                <ExpandAllIcon allExpanded={allExpanded} />
              </button>
              {showHideButton && (
                <div className={styles.menuWrapper}>
                  <WorksheetVisibilityMenuButton
                    courses={courses}
                    className={styles.controlButton}
                    menuClassName={clsx(
                      styles.exportMenu,
                      styles.visibilityMenu,
                    )}
                    backdropClassName={styles.menuBackdrop}
                    iconSize={15}
                    open={visibilityMenuOpen}
                    onOpenChange={(nextOpen) => {
                      changeControlsMenu(nextOpen ? 'visibility' : null);
                    }}
                  />
                </div>
              )}
              {showSettings && (
                <div className={styles.menuWrapperStatic}>
                  <button
                    type="button"
                    className={styles.controlButton}
                    onClick={() =>
                      changeControlsMenu(settingsMenuOpen ? null : 'settings')
                    }
                    title="Worksheet settings"
                    aria-label="Worksheet settings"
                    aria-haspopup="menu"
                    aria-expanded={settingsMenuOpen}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {settingsMenuOpen && (
                    <>
                      <button
                        type="button"
                        className={styles.menuBackdrop}
                        onClick={closeSettingsMenu}
                        aria-label="Close settings menu"
                        tabIndex={-1}
                      />
                      <div className={styles.settingsMenu} role="menu">
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={hideConflictWarnings}
                          className={styles.settingsMenuRow}
                          onClick={() =>
                            setHideConflictWarnings(!hideConflictWarnings)
                          }
                        >
                          <span className={styles.settingsMenuRowLabel}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            Hide conflict warnings
                          </span>
                          {hideConflictWarnings && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--ct-accent-text)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                        {!isReadonlyWorksheet &&
                          (courses.length > 0 || clearedSnapshot) && (
                            <>
                              <div
                                className={styles.settingsMenuDivider}
                                aria-hidden="true"
                              />
                              {confirmClear ? (
                                <div className={styles.confirmBlock}>
                                  <div className={styles.confirmText}>
                                    Remove all {courses.length}{' '}
                                    {courses.length === 1
                                      ? 'course'
                                      : 'courses'}{' '}
                                    from this worksheet?
                                  </div>
                                  <div className={styles.confirmActions}>
                                    <button
                                      type="button"
                                      className={styles.confirmClearButton}
                                      disabled={clearing}
                                      onClick={() => {
                                        void handleClearAll();
                                      }}
                                    >
                                      {clearing ? 'Clearing…' : 'Clear all'}
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.confirmCancelButton}
                                      onClick={() => setConfirmClear(false)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : courses.length > 0 ? (
                                <button
                                  type="button"
                                  className={styles.settingsMenuDanger}
                                  onClick={() => setConfirmClear(true)}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                  Clear all courses
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.settingsMenuRestore}
                                  onClick={() => {
                                    void handleRestoreAll();
                                  }}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                  </svg>
                                  Restore all courses
                                </button>
                              )}
                            </>
                          )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className={styles.menuWrapper}>
                <button
                  type="button"
                  className={styles.controlButton}
                  onClick={() => {
                    changeControlsMenu(exportMenuOpen ? null : 'export');
                  }}
                  title="Export worksheet"
                  aria-label="Export worksheet"
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M12 14l0 4" />
                    <path d="M9 17l3 3 3-3" />
                  </svg>
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {exportMenuOpen && (
                  <WorksheetExportMenu
                    onClose={() => changeControlsMenu(null)}
                  />
                )}
              </div>
            </div>

            {warnings.length > 0 && (
              <div className={styles.warnings}>
                {warnings.map((warning) => (
                  <div key={warning} className={styles.warning}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <WeeklyLoadChart
              courses={visibleCourses}
              busiestLabel={busiest?.label ?? null}
            />
          </div>

          <div className={styles.content}>
            <div className={styles.courseList}>
              {visibleCourses.map((course) => (
                <WorksheetListItem
                  key={viewedSeason + course.crn}
                  course={course}
                  expanded={expandedCrns.has(course.crn)}
                  colorMenuOpen={openColorMenuCrn === course.crn}
                  boundedColorMenu={isMobile}
                  conflicts={
                    hideConflictWarnings
                      ? []
                      : (conflictsByCrn.get(course.crn) ?? [])
                  }
                  onToggleExpand={() => toggleOneExpand(course.crn)}
                  onColorMenuOpenChange={(open) =>
                    setOpenColorMenuCrn(open ? course.crn : null)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          {warnings.length > 0 && (
            <div className={styles.warnings}>
              {warnings.map((warning) => (
                <div key={warning} className={styles.warning}>
                  {warning}
                </div>
              ))}
            </div>
          )}
          <NoCourses
            heading={
              anonymousEmptyTermChips.length > 0 ||
              savedWorksheetEmptyTermChips.length > 0
                ? `${toSeasonString(viewedSeason)} worksheet is empty`
                : undefined
            }
          >
            {anonymousEmptyTermChips.length > 0 ? (
              <div className={styles.emptyTermContent}>
                <p className={styles.emptyTermText}>
                  This term&apos;s worksheet is empty. Your courses are in:
                </p>
                <div className={styles.emptyTermChips}>
                  {anonymousEmptyTermChips.map((chip) => (
                    <button
                      key={chip.term}
                      type="button"
                      className={styles.emptyTermChip}
                      onClick={() => changeViewedSeason(chip.term)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : savedWorksheetEmptyTermChips.length > 0 ? (
              <div className={styles.emptyTermContent}>
                <p className={styles.emptyTermText}>
                  This term&apos;s worksheet is empty. Your courses are in:
                </p>
                <div className={styles.emptyTermChips}>
                  {savedWorksheetEmptyTermChips.map((chip) => (
                    <button
                      key={chip.term}
                      type="button"
                      className={styles.emptyTermChip}
                      onClick={() => {
                        void ensureMainSavedWorksheetForTerm(chip.term);
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : undefined}
            {clearedSnapshot !== null &&
              showSettings &&
              !isReadonlyWorksheet && (
                <div className={styles.emptyRestoreWrap}>
                  <button
                    type="button"
                    className={styles.emptyTermChip}
                    onClick={() => {
                      void handleRestoreAll();
                    }}
                  >
                    Restore all courses
                  </button>
                </div>
              )}
          </NoCourses>
        </div>
      )}

      {conflictModalOpen && (
        <ConflictModal
          conflicts={scheduleConflicts}
          courses={visibleCourses}
          onClose={() => setConflictModalOpen(false)}
        />
      )}

      {examsModalOpen && (
        <ExamsModal
          courses={visibleCourses}
          onClose={() => setExamsModalOpen(false)}
        />
      )}

      {isMobile && (
        <WorksheetColorSheet
          courses={visibleCourses}
          selectedCrn={openColorMenuCrn}
          onClose={() => setOpenColorMenuCrn(null)}
        />
      )}
    </div>
  );
}

export default WorksheetList;
