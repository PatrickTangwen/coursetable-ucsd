import { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, DropdownButton } from 'react-bootstrap';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { FiDownload, FiLink } from 'react-icons/fi';
import { TbCalendarUp } from 'react-icons/tb';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import ConflictModal from './ConflictModal';
import ExamsModal from './ExamsModal';
import { useICSExport } from './ICSExportButton';
import { useWorksheetSeasonCodes } from './SeasonDropdown';
import { useWorksheetURLExport } from './URLExportButton';
import WeeklyLoadChart from './WeeklyLoadChart';
import {
  buildCourseImports,
  getAnonymousWorksheetTermChips,
  getSavedWorksheetTermChips,
} from './WorksheetCalendarList';
import {
  busiestDay,
  creditLoad,
  firstExam,
  hasAnyExam,
} from './worksheetInsights';
import WorksheetListItem from './WorksheetListItem';
import WorksheetStatusIcon from './WorksheetStatusIcon';
import {
  isLegacyUserInfo,
  setCourseHidden,
  updateWorksheetCourses,
  updateWorksheetMetadata,
  type SavedWorksheetSection,
} from '../../queries/api';
import type { Crn } from '../../queries/graphql-types';
import { useWorksheetNumberOptions } from '../../slices/WorksheetSlice';
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
  | { kind: 'anonymous'; courses: AnonymousWorksheetCourse[] }
  | { kind: 'legacy'; courses: { crn: Crn; color: string; hidden: boolean }[] };

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
          <FiDownload size={13} aria-hidden="true" />
          Export .ics
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
          <FiLink size={13} aria-hidden="true" />
          Copy URL
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
    isViewedWorksheetPrivate,
    viewedPerson,
    friends,
    worksheets,
    user,
    isAnonymousWorksheet,
    anonymousWorksheet,
    worksheetMissingSectionIds,
    isMobile,
    changeViewedSeason,
    setAllAnonymousWorksheetHidden,
    setAllActiveSavedWorksheetHidden,
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
      isViewedWorksheetPrivate:
        state.worksheetMemo.getIsViewedWorksheetPrivate(state),
      viewedPerson: state.viewedPerson,
      friends: state.friends,
      worksheets: state.worksheets,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      worksheetMissingSectionIds: state.worksheetMissingSectionIds,
      isMobile: state.isMobile,
      changeViewedSeason: state.changeViewedSeason,
      setAllAnonymousWorksheetHidden: state.setAllAnonymousWorksheetHidden,
      setAllActiveSavedWorksheetHidden: state.setAllActiveSavedWorksheetHidden,
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
  const worksheetsRefresh = useStore((state) => state.worksheetsRefresh);
  const seasonCodes = useWorksheetSeasonCodes();

  const [expandedCrns, setExpandedCrns] = useState<ReadonlySet<Crn>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [examsModalOpen, setExamsModalOpen] = useState(false);
  const [updatingWSState, setUpdatingWSState] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearedSnapshot, setClearedSnapshot] =
    useState<ClearedSnapshot | null>(null);
  const [showImportRow, setShowImportRow] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importTargetWorksheet, setImportTargetWorksheet] = useState(0);

  const closeSettingsMenu = () => {
    setSettingsMenuOpen(false);
    setConfirmClear(false);
  };

  // A cleared-courses snapshot only makes sense for the worksheet it came
  // from; switching term or worksheet discards it.
  const worksheetKey = `${viewedSeason}|${activeSavedWorksheet?.id ?? ''}|${viewedWorksheetNumber}`;
  useEffect(() => {
    setExpandedCrns(new Set());
    setClearedSnapshot(null);
    setConfirmClear(false);
  }, [worksheetKey]);

  const hasLegacyWorksheetAccount = isLegacyUserInfo(user);
  const hasSavedWorksheetAccount = Boolean(user && !hasLegacyWorksheetAccount);
  const canMutateCurrentWorksheet =
    isAnonymousWorksheet ||
    hasLegacyWorksheetAccount ||
    hasSavedWorksheetAccount;

  useEffect(() => {
    if (!isExoticWorksheet || !hasLegacyWorksheetAccount) {
      setShowImportRow(false);
      setImportTargetWorksheet(0);
    }
  }, [hasLegacyWorksheetAccount, isExoticWorksheet]);

  const { courseCount, credits } = getWorksheetCourseStats(courses);
  const load = creditLoad(credits);
  const areHidden = useMemo(
    () => courses.length > 0 && courses.every((course) => course.hidden),
    [courses],
  );
  const allExpanded =
    courses.length > 0 &&
    courses.every((course) => expandedCrns.has(course.crn));

  // Match the calendar: hidden courses don't take part in conflicts or the
  // schedule insights.
  const visibleCourses = useMemo(
    () => courses.filter((course) => !course.hidden),
    [courses],
  );
  const exam = useMemo(() => firstExam(visibleCourses), [visibleCourses]);
  // The all-exams modal covers every course, hidden included.
  const anyExam = useMemo(() => hasAnyExam(courses), [courses]);
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
  const showWorksheetPrivacySetting =
    !isAnonymousWorksheet && hasLegacyWorksheetAccount;
  const showImport =
    isExoticWorksheet && hasLegacyWorksheetAccount && !hasSavedWorksheetAccount;

  const importSeason = exoticWorksheet?.data.season ?? viewedSeason;
  const importWorksheetOptions = useWorksheetNumberOptions('me', importSeason);

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
      allExpanded ? new Set() : new Set(courses.map((course) => course.crn)),
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

  const handleToggleAllHidden = async () => {
    if (isAnonymousWorksheet) {
      setAllAnonymousWorksheetHidden(!areHidden);
      return;
    }
    if (hasSavedWorksheetAccount) {
      await setAllActiveSavedWorksheetHidden(!areHidden);
      return;
    }
    await setCourseHidden({
      season: viewedSeason,
      worksheetNumber: viewedWorksheetNumber,
      crn: courses.map((course) => course.listing.crn),
      hidden: !areHidden,
    });
    await worksheetsRefresh();
  };

  const handleClearAll = async () => {
    if (courses.length === 0) return;
    const courseCnt = courses.length;
    const removedToast = () => {
      toast.success(
        courseCnt === 1
          ? 'Removed class from worksheet'
          : `Removed all ${courseCnt} classes from worksheet`,
      );
    };

    if (isAnonymousWorksheet) {
      const anonymousSnapshot = getAnonymousWorksheetCourses(
        anonymousWorksheet,
        viewedSeason,
      );
      clearAnonymousWorksheet();
      setClearedSnapshot({ kind: 'anonymous', courses: anonymousSnapshot });
      closeSettingsMenu();
      removedToast();
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
          removedToast();
        }
      } finally {
        setClearing(false);
      }
      return;
    }

    const snapshot = courses.map((course) => ({
      crn: course.listing.crn,
      color: course.color,
      hidden: Boolean(course.hidden),
    }));
    const actions = courses.map((course) => ({
      action: 'remove' as const,
      season: viewedSeason,
      crn: course.listing.crn,
      worksheetNumber: viewedWorksheetNumber,
    }));

    setClearing(true);
    try {
      const success = await updateWorksheetCourses(actions);
      if (success) {
        await worksheetsRefresh();
        setClearedSnapshot({ kind: 'legacy', courses: snapshot });
        closeSettingsMenu();
        removedToast();
      }
    } finally {
      setClearing(false);
    }
  };

  const handleRestoreAll = async () => {
    if (!clearedSnapshot) return;
    if (clearedSnapshot.kind === 'anonymous') {
      restoreAnonymousWorksheetCourses(clearedSnapshot.courses);
    } else if (clearedSnapshot.kind === 'saved') {
      await restoreActiveSavedWorksheetSections(clearedSnapshot.sections);
    } else {
      const success = await updateWorksheetCourses(
        clearedSnapshot.courses.map((course) => ({
          action: 'add' as const,
          season: viewedSeason,
          crn: course.crn,
          worksheetNumber: viewedWorksheetNumber,
          color: course.color,
          hidden: course.hidden,
        })),
      );
      if (success) await worksheetsRefresh();
    }
    setClearedSnapshot(null);
    closeSettingsMenu();
  };

  const handleTogglePrivate = async () => {
    if (updatingWSState || viewedWorksheetNumber === 0) return;
    setUpdatingWSState(true);
    try {
      await updateWorksheetMetadata({
        season: viewedSeason,
        action: 'setPrivate',
        worksheetNumber: viewedWorksheetNumber,
        private: !isViewedWorksheetPrivate,
      });
      await worksheetsRefresh();
    } finally {
      setUpdatingWSState(false);
    }
  };

  const handleImport = async () => {
    if (isImporting) return;
    setIsImporting(true);

    const targetWorksheet = worksheets
      ?.get(importSeason)
      ?.get(importTargetWorksheet);

    if (courses.length === 0) {
      toast.error('Current worksheet has no courses to import');
      setIsImporting(false);
      return;
    }

    const actions = buildCourseImports(
      courses,
      importSeason,
      importTargetWorksheet,
      targetWorksheet,
    );

    if (actions.length === 0) {
      toast.success('All courses imported successfully');
      setIsImporting(false);
      setShowImportRow(false);
      return;
    }

    try {
      const success = await updateWorksheetCourses(actions);
      if (success) {
        await worksheetsRefresh();
        toast.success(
          `Imported ${actions.length} course${actions.length === 1 ? '' : 's'}`,
        );
        setShowImportRow(false);
      }
    } catch (error) {
      toast.error('Failed to import courses. Please try again.');
      console.error('Failed to import courses:', error);
    } finally {
      setIsImporting(false);
    }
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

      <div className={styles.summaryStack}>
        <div className={styles.dashboardGrid}>
          <div className={styles.dashTile}>
            <div className={styles.dashLabel}>Courses</div>
            <div className={styles.dashValue}>{courseCount}</div>
            <div className={styles.dashSub}>planned</div>
          </div>
          <div className={styles.dashTile}>
            <div className={styles.dashLabel}>Credits</div>
            <div className={styles.dashValue}>{credits}</div>
            <div className={styles.dashLoad} style={{ color: load.color }}>
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
                <span className={styles.conflictPulseDot} aria-hidden="true" />
              )}
              <div className={styles.dashLabel}>Conflicts</div>
              <div className={styles.dashValue}>{scheduleConflicts.length}</div>
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
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#639922"
                  strokeWidth="2.6"
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

        {courses.length > 0 && (
          <WeeklyLoadChart
            courses={visibleCourses}
            busiestLabel={busiest?.label ?? null}
          />
        )}

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
            <button
              type="button"
              className={styles.controlButton}
              onClick={() => {
                void handleToggleAllHidden();
              }}
              title={areHidden ? 'Show all' : 'Hide all'}
              aria-label={`${areHidden ? 'Show' : 'Hide'} all`}
            >
              {areHidden ? (
                <BsEyeSlash size={15} aria-hidden="true" />
              ) : (
                <BsEye size={15} aria-hidden="true" />
              )}
            </button>
          )}
          {showSettings && (
            <div className={styles.menuWrapper}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={() => {
                  if (settingsMenuOpen) closeSettingsMenu();
                  else setSettingsMenuOpen(true);
                }}
                title="Worksheet settings"
                aria-label="Worksheet settings"
                aria-haspopup="menu"
                aria-expanded={settingsMenuOpen}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <svg
                  width="8"
                  height="5"
                  viewBox="0 0 10 6"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                      <span>Hide conflict warnings</span>
                      {hideConflictWarnings && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#185fa5"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    {showWorksheetPrivacySetting && (
                      <>
                        <div
                          className={styles.settingsMenuDivider}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={isViewedWorksheetPrivate}
                          className={styles.settingsMenuRow}
                          disabled={
                            viewedWorksheetNumber === 0 || updatingWSState
                          }
                          title={
                            viewedWorksheetNumber === 0
                              ? 'Your main worksheet must always be public.'
                              : undefined
                          }
                          onClick={() => {
                            void handleTogglePrivate();
                          }}
                        >
                          <span>Private worksheet</span>
                          {isViewedWorksheetPrivate && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#185fa5"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
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
                                {courses.length === 1 ? 'course' : 'courses'}{' '}
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
              onClick={() => setExportMenuOpen((open) => !open)}
              title="Export worksheet"
              aria-label="Export worksheet"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
            >
              <FiDownload size={13} aria-hidden="true" />
              <svg
                width="8"
                height="5"
                viewBox="0 0 10 6"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {exportMenuOpen && (
              <WorksheetExportMenu onClose={() => setExportMenuOpen(false)} />
            )}
          </div>
          {showImport && (
            <button
              type="button"
              className={styles.controlButton}
              onClick={() => setShowImportRow((open) => !open)}
              title="Import courses into your worksheet"
              aria-label="Import courses"
              aria-expanded={showImportRow}
            >
              <TbCalendarUp size={15} aria-hidden="true" />
            </button>
          )}
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

        {showImportRow && (
          <div className={styles.importRow}>
            <span className={styles.importLabel}>Import into:</span>
            <DropdownButton
              size="sm"
              variant="outline-secondary"
              className={styles.importDropdown}
              title={
                <>
                  {WorksheetStatusIcon(
                    importTargetWorksheet,
                    importWorksheetOptions[importTargetWorksheet]?.isPrivate,
                  )}
                  <span className={styles.importDropdownTitle}>
                    {importWorksheetOptions[importTargetWorksheet]?.label ??
                      'Main Worksheet'}
                  </span>
                </>
              }
              onSelect={(key) => {
                if (key !== null) setImportTargetWorksheet(Number(key));
              }}
            >
              {Object.values(importWorksheetOptions).map((opt) => (
                <Dropdown.Item
                  key={opt.value}
                  eventKey={opt.value}
                  active={opt.value === importTargetWorksheet}
                >
                  {WorksheetStatusIcon(opt.value, opt.isPrivate)}
                  {opt.label}
                </Dropdown.Item>
              ))}
            </DropdownButton>
            <Button
              variant="primary"
              size="sm"
              disabled={isImporting}
              onClick={() => {
                void handleImport();
              }}
            >
              {isImporting ? 'Importing...' : 'Confirm'}
            </Button>
          </div>
        )}
      </div>

      {courses.length > 0 ? (
        <div className={styles.courseList}>
          {courses.map((course) => (
            <WorksheetListItem
              key={viewedSeason + course.crn}
              course={course}
              expanded={expandedCrns.has(course.crn)}
              conflicts={
                hideConflictWarnings
                  ? []
                  : (conflictsByCrn.get(course.crn) ?? [])
              }
              onToggleExpand={() => toggleOneExpand(course.crn)}
            />
          ))}
        </div>
      ) : (
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
        </NoCourses>
      )}

      {conflictModalOpen && (
        <ConflictModal
          conflicts={scheduleConflicts}
          courses={courses}
          onClose={() => setConflictModalOpen(false)}
        />
      )}

      {examsModalOpen && (
        <ExamsModal
          courses={courses}
          onClose={() => setExamsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default WorksheetList;
