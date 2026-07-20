import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import { getQuickModalData } from './CalendarQuickModal';
import ConflictModal from './ConflictModal';
import ExamsModal from './ExamsModal';
import { useICSExport } from './ICSExportButton';
import { useCalendarPNGExport } from './PNGExportButton';
import { useWorksheetURLExport } from './URLExportButton';
import {
  type WorksheetControlsMenu,
  WorksheetColorMenuButton,
  WorksheetColorMenuSlot,
  WorksheetVisibilityMenuButton,
  worksheetColorMenuHostClassName,
} from './WorksheetCourseMenus';
import { useToggleCourseHidden } from './WorksheetHideButton';
import {
  busiestDay,
  creditLoad,
  firstExam,
  hasAnyExam,
} from './worksheetInsights';
import { worksheetExportMenuCopy } from './worksheetMenuCopy';
import WorksheetPicker, { useCloseOnOutsideClick } from './WorksheetPicker';
import noCoursesImg from '../../images/calendar_img_high_res.png';
import type { SavedWorksheetSection } from '../../queries/api';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import {
  getAnonymousWorksheetCourses,
  type AnonymousWorksheetCourse,
} from '../../utilities/anonymousWorksheet';
import { getWorksheetColorAppearance } from '../../utilities/constants';
import { getWorksheetCourseStats } from '../../utilities/course';
import { createCatalogLink } from '../../utilities/navigation';
import { getScheduleConflicts } from '../../utilities/scheduleConflicts';
import styles from './WorksheetCalendarSidebar.module.css';

type ClearedSnapshot =
  | { kind: 'saved'; sections: SavedWorksheetSection[] }
  | { kind: 'anonymous'; courses: AnonymousWorksheetCourse[] };

function sectionOf(course: WorksheetCourse) {
  const details = (
    course.listing.course as {
      ucsd_calendar?: { section_code?: string | null };
    }
  ).ucsd_calendar;
  return details?.section_code ?? course.listing.course.section;
}

function MenuCheckIcon() {
  return (
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
  );
}

function WorksheetHeader({
  onOpenChange,
}: {
  readonly onOpenChange: (open: boolean) => void;
}) {
  const {
    viewedSeason,
    activeSavedWorksheet,
    savedWorksheetSummaries,
    selectSavedWorksheet,
    createBlankSavedWorksheetForTerm,
    renameSavedWorksheet,
    deleteSavedWorksheet,
  } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      activeSavedWorksheet: state.activeSavedWorksheet,
      savedWorksheetSummaries: state.savedWorksheetSummaries,
      selectSavedWorksheet: state.selectSavedWorksheet,
      createBlankSavedWorksheetForTerm: state.createBlankSavedWorksheetForTerm,
      renameSavedWorksheet: state.renameSavedWorksheet,
      deleteSavedWorksheet: state.deleteSavedWorksheet,
    })),
  );

  return (
    <WorksheetPicker
      viewedSeason={viewedSeason}
      activeSavedWorksheet={activeSavedWorksheet}
      savedWorksheetSummaries={savedWorksheetSummaries}
      selectSavedWorksheet={selectSavedWorksheet}
      createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
      renameSavedWorksheet={renameSavedWorksheet}
      deleteSavedWorksheet={deleteSavedWorksheet}
      onOpenChange={onOpenChange}
    />
  );
}

function CourseCard({
  course,
  canEdit,
  hasConflict,
  conflictTooltip,
  expanded,
  colorMenuOpen,
  showColorPalette,
  onToggleExpand,
  onColorMenuOpenChange,
  onRemove,
}: {
  readonly course: WorksheetCourse;
  readonly canEdit: boolean;
  readonly hasConflict: boolean;
  readonly conflictTooltip: string | null;
  readonly expanded: boolean;
  readonly colorMenuOpen: boolean;
  readonly showColorPalette: boolean;
  readonly onToggleExpand: () => void;
  readonly onColorMenuOpenChange: (open: boolean) => void;
  readonly onRemove: (courseToRemove: WorksheetCourse) => void;
}) {
  const { hoverCourse, setHoverCourse, theme } = useStore(
    useShallow((s) => ({
      hoverCourse: s.hoverCourse,
      setHoverCourse: s.setHoverCourse,
      theme: s.theme,
    })),
  );
  const [, setSearchParams] = useSearchParams();
  const colorMenuContainerRef = useRef<HTMLDivElement>(null);

  const { crn } = course.listing;
  const { exams } = useMemo(
    () => getQuickModalData(course.listing, null),
    [course.listing],
  );
  const section = sectionOf(course);
  const primaryColor = useMemo(
    () => getWorksheetColorAppearance(course.color, theme).primary,
    [course.color, theme],
  );

  const openModal = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(
        'course-modal',
        `${course.listing.course.season_code}-${course.listing.crn}`,
      );
      return next;
    });
  };

  return (
    <div
      className={clsx(styles.card, worksheetColorMenuHostClassName)}
      data-hovered={(hoverCourse === crn && !expanded) || undefined}
      data-expanded={expanded || undefined}
      data-color-menu-open={colorMenuOpen || undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- clickable card row wraps nested buttons */}
      <div
        className={styles.cardMain}
        role="button"
        tabIndex={0}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openModal();
        }}
        onMouseEnter={() => setHoverCourse(crn)}
        onMouseLeave={() => setHoverCourse(null)}
        onFocus={() => setHoverCourse(crn)}
        onBlur={() => setHoverCourse(null)}
      >
        <span
          className={styles.colorBar}
          style={{ background: primaryColor }}
          aria-hidden="true"
        />
        <div className={styles.cardInfo}>
          <span className={styles.cardCodeLine}>
            <strong className={styles.cardCode}>
              {course.listing.course_code}
            </strong>
            {section && <span className={styles.cardSection}> {section}</span>}
            {hasConflict && (
              <span
                className={styles.cardConflictIcon}
                title={conflictTooltip ?? 'Time conflict with another course'}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            )}
          </span>
          <span className={styles.cardTitle}>
            {course.listing.course.title}
          </span>
        </div>
        {canEdit && showColorPalette && (
          <WorksheetColorMenuButton
            course={course}
            className={styles.cardColorButton}
            iconSize={18}
            boundedContainerRef={colorMenuContainerRef}
            open={colorMenuOpen}
            onOpenChange={onColorMenuOpenChange}
          />
        )}
        <button
          type="button"
          className={styles.cardExpandButton}
          aria-label={
            expanded ? 'Collapse exam details' : 'Expand exam details'
          }
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.cardChevron}
            data-open={expanded || undefined}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <WorksheetColorMenuSlot
        containerRef={colorMenuContainerRef}
        className={styles.cardColorMenuSlot}
      />
      {expanded && (
        <div className={styles.cardDetails}>
          {exams.length === 0 && (
            <div className={styles.examEntry}>
              <span
                className={styles.examDot}
                style={{ background: primaryColor }}
                aria-hidden="true"
              />
              <div className={styles.examEntryBody}>
                <span className={styles.examKindNone}>No exams</span>
                <div className={styles.examEntryDate}>
                  No final or midterm scheduled
                </div>
              </div>
            </div>
          )}
          {exams.map((exam) => (
            <div key={exam.key} className={styles.examEntry}>
              <span
                className={styles.examDot}
                style={{ background: primaryColor }}
                aria-hidden="true"
              />
              <div className={styles.examEntryBody}>
                <div className={styles.examEntryKindRow}>
                  <span
                    className={
                      exam.typeCode === 'FI'
                        ? styles.examKindFinal
                        : styles.examKindMidterm
                    }
                  >
                    {exam.kind}
                  </span>
                  <span
                    className={styles.examBadge}
                    data-tone={exam.badge.tone}
                  >
                    {exam.badge.label}
                  </span>
                </div>
                <div className={styles.examEntryDate}>{exam.date}</div>
                <div className={styles.examEntryMeta}>{exam.meta}</div>
              </div>
            </div>
          ))}
          {canEdit && (
            <div className={styles.cardDetailsFooter}>
              <button
                type="button"
                className={styles.removeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(course);
                }}
              >
                <svg
                  width="13"
                  height="13"
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
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorksheetCalendarSidebar() {
  const {
    courses,
    viewedSeason,
    viewedWorksheetNumber,
    user,
    isAnonymousWorksheet,
    anonymousWorksheet,
    activeSavedWorksheet,
    gridStyle,
    setGridStyle,
    hideConflictWarnings,
    setHideConflictWarnings,
    showCalendarColorPalette,
    setShowCalendarColorPalette,
    showCalendarNowLine,
    setShowCalendarNowLine,
    removeAnonymousWorksheetListing,
    removeActiveSavedWorksheetListing,
    clearAnonymousWorksheet,
    clearActiveSavedWorksheet,
    restoreAnonymousWorksheetCourses,
    restoreActiveSavedWorksheetSections,
    changeWorksheetView,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      gridStyle: state.calendarGridStyle,
      setGridStyle: state.setCalendarGridStyle,
      hideConflictWarnings: state.hideConflictWarnings,
      setHideConflictWarnings: state.setHideConflictWarnings,
      showCalendarColorPalette: state.showCalendarColorPalette,
      setShowCalendarColorPalette: state.setShowCalendarColorPalette,
      showCalendarNowLine: state.showCalendarNowLine,
      setShowCalendarNowLine: state.setShowCalendarNowLine,
      removeAnonymousWorksheetListing: state.removeAnonymousWorksheetListing,
      removeActiveSavedWorksheetListing:
        state.removeActiveSavedWorksheetListing,
      clearAnonymousWorksheet: state.clearAnonymousWorksheet,
      clearActiveSavedWorksheet: state.clearActiveSavedWorksheet,
      restoreAnonymousWorksheetCourses: state.restoreAnonymousWorksheetCourses,
      restoreActiveSavedWorksheetSections:
        state.restoreActiveSavedWorksheetSections,
      changeWorksheetView: state.changeWorksheetView,
    })),
  );
  const toggleCourseHidden = useToggleCourseHidden();
  const canEdit = toggleCourseHidden !== null;
  const hasSavedWorksheetAccount = Boolean(user);
  const icsExport = useICSExport();
  const urlExport = useWorksheetURLExport();
  const { exportPNG, isExporting: isExportingPNG } = useCalendarPNGExport();

  const [openControlsMenu, setOpenControlsMenu] =
    useState<WorksheetControlsMenu>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [examsModalOpen, setExamsModalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearedSnapshot, setClearedSnapshot] =
    useState<ClearedSnapshot | null>(null);
  const [expandedCards, setExpandedCards] = useState<ReadonlySet<Crn>>(
    () => new Set(),
  );
  const [openColorMenuCrn, setOpenColorMenuCrn] = useState<Crn | null>(null);
  const styleMenuOpen = openControlsMenu === 'settings';
  const visibilityMenuOpen = openControlsMenu === 'visibility';
  const exportMenuOpen = openControlsMenu === 'export';
  const changeControlsMenu = (nextMenu: WorksheetControlsMenu) => {
    if (nextMenu !== 'settings') setConfirmClear(false);
    setOpenControlsMenu(nextMenu);
  };
  const closeStyleMenu = () => {
    changeControlsMenu(null);
  };
  const styleRef = useCloseOnOutsideClick(styleMenuOpen, closeStyleMenu);
  const visibilityRef = useCloseOnOutsideClick(visibilityMenuOpen, () =>
    changeControlsMenu(null),
  );
  const exportRef = useCloseOnOutsideClick(exportMenuOpen, () =>
    changeControlsMenu(null),
  );

  // A cleared-courses snapshot only makes sense for the worksheet it came
  // from; switching term or worksheet discards it.
  const worksheetKey = `${viewedSeason}|${activeSavedWorksheet?.id ?? ''}|${viewedWorksheetNumber}`;
  useEffect(() => {
    setClearedSnapshot(null);
    setConfirmClear(false);
    setOpenControlsMenu(null);
    setOpenColorMenuCrn(null);
  }, [worksheetKey]);

  // Match the grid: hidden courses don't render there, so they don't count
  // toward the dashboard stats or conflicts.
  const visibleCourses = useMemo(
    () => courses.filter((c) => !c.hidden),
    [courses],
  );
  const { courseCount, credits } = useMemo(
    () => getWorksheetCourseStats(visibleCourses),
    [visibleCourses],
  );
  const load = creditLoad(credits);
  const exam = useMemo(() => firstExam(visibleCourses), [visibleCourses]);
  const anyExam = useMemo(() => hasAnyExam(visibleCourses), [visibleCourses]);
  const busiest = useMemo(() => busiestDay(visibleCourses), [visibleCourses]);
  const visibleConflicts = useMemo(
    () => getScheduleConflicts(visibleCourses),
    [visibleCourses],
  );
  const conflictPartners = useMemo(() => {
    const sectionByCrn = new Map(
      visibleCourses.map((c) => [c.listing.crn, sectionOf(c)]),
    );
    const label = (crn: Crn, code: string) => {
      const section = sectionByCrn.get(crn);
      return section ? `${code} ${section}` : code;
    };
    const partners = new Map<Crn, Set<string>>();
    const add = (crn: Crn, partner: string) => {
      const set = partners.get(crn) ?? new Set();
      set.add(partner);
      partners.set(crn, set);
    };
    for (const conflict of visibleConflicts) {
      add(conflict.a.crn, label(conflict.b.crn, conflict.b.courseCode));
      add(conflict.b.crn, label(conflict.a.crn, conflict.a.courseCode));
    }
    return partners;
  }, [visibleConflicts, visibleCourses]);

  const allExpanded =
    visibleCourses.length > 0 &&
    visibleCourses.every((c) => expandedCards.has(c.listing.crn));
  const toggleExpandAll = () => {
    setExpandedCards(
      allExpanded
        ? new Set()
        : new Set(visibleCourses.map((c) => c.listing.crn)),
    );
  };
  const toggleCardExpanded = (crn: Crn) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(crn)) next.delete(crn);
      else next.add(crn);
      return next;
    });
  };

  const clearAllCourses = async () => {
    if (courses.length === 0) return;
    if (isAnonymousWorksheet) {
      const snapshot = getAnonymousWorksheetCourses(
        anonymousWorksheet,
        viewedSeason,
      );
      clearAnonymousWorksheet();
      setClearedSnapshot({ kind: 'anonymous', courses: snapshot });
    } else if (hasSavedWorksheetAccount) {
      const sections = activeSavedWorksheet?.sections ?? [];
      if (await clearActiveSavedWorksheet())
        setClearedSnapshot({ kind: 'saved', sections });
    }
    closeStyleMenu();
  };

  const restoreAllCourses = async () => {
    if (!clearedSnapshot) return;
    if (clearedSnapshot.kind === 'anonymous')
      restoreAnonymousWorksheetCourses(clearedSnapshot.courses);
    else await restoreActiveSavedWorksheetSections(clearedSnapshot.sections);
    setClearedSnapshot(null);
    closeStyleMenu();
  };

  const removeCourse = async (course: WorksheetCourse) => {
    if (isAnonymousWorksheet) removeAnonymousWorksheetListing(course.listing);
    else if (hasSavedWorksheetAccount)
      await removeActiveSavedWorksheetListing(course.listing);
  };

  const gridStyleOptions = [
    { value: 'paper', label: 'Paper' },
    { value: 'embossed', label: 'Embossed' },
    { value: 'colorBar', label: 'Color Bar' },
  ] as const;

  return (
    <div className={styles.sidebar}>
      {hasSavedWorksheetAccount && (
        <WorksheetHeader onOpenChange={setPickerOpen} />
      )}
      {pickerOpen && (
        <div className={styles.pickerBackdrop} aria-hidden="true" />
      )}

      <div className={styles.statsBlock}>
        <div className={styles.statsGrid}>
          <div className={styles.statTile}>
            <span className={styles.statTileLabel}>Courses</span>
            <span className={styles.statTileValue}>{courseCount}</span>
            <span className={styles.statTileSub}>planned</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statTileLabel}>Credits</span>
            <span className={styles.statTileValue}>{credits}</span>
            <span className={styles.statTileSubStrong}>
              <span
                className={styles.loadDot}
                style={{ background: load.color }}
                aria-hidden="true"
              />
              {load.label}
            </span>
          </div>
          {visibleConflicts.length > 0 ? (
            <button
              type="button"
              className={styles.conflictTile}
              data-muted={hideConflictWarnings || undefined}
              onClick={() => setConflictModalOpen(true)}
            >
              {!hideConflictWarnings && (
                <span className={styles.conflictPulseDot} aria-hidden="true" />
              )}
              <span className={styles.statTileLabel}>Conflicts</span>
              <span className={styles.statTileValue}>
                {visibleConflicts.length}
              </span>
              {/* The sidebar tile is too narrow for "warnings hidden" */}
              <span className={styles.conflictTileView}>
                {hideConflictWarnings ? 'hidden' : 'View'}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>
          ) : (
            <div className={styles.statTile}>
              <span className={styles.statTileLabel}>Conflicts</span>
              <span className={styles.statTileValue}>0</span>
              <span className={styles.statTileSubStrong}>
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
              </span>
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
              <span className={styles.infoTileLabel}>
                <svg
                  width="12"
                  height="12"
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
              </span>
              <span className={styles.infoTileValue}>
                {exam ? exam.countdown : '—'}
              </span>
              <span className={styles.infoTileSubRow}>
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
              </span>
            </button>
          ) : (
            <div className={styles.infoTile}>
              <span className={styles.infoTileLabel}>
                <svg
                  width="12"
                  height="12"
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
              </span>
              <span className={styles.infoTileValue}>—</span>
              <span className={styles.infoTileSub}>First · —</span>
            </div>
          )}
          {busiest ? (
            <button
              type="button"
              className={styles.examTileButton}
              onClick={() => changeWorksheetView('list')}
            >
              <span className={styles.infoTileLabel}>
                <svg
                  width="12"
                  height="12"
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
              </span>
              <span className={styles.infoTileValue}>{busiest.label}</span>
              <span className={styles.infoTileSubRow}>
                {busiest.count} {busiest.count === 1 ? 'class' : 'classes'}
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
              </span>
            </button>
          ) : (
            <div className={styles.infoTile}>
              <span className={styles.infoTileLabel}>
                <svg
                  width="12"
                  height="12"
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
              </span>
              <span className={styles.infoTileValue}>—</span>
              <span className={styles.infoTileSub}>No weekly classes</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.controlsRow}>
        {canEdit && (
          <div ref={visibilityRef} className={styles.controlWrapper}>
            <WorksheetVisibilityMenuButton
              courses={courses}
              className={styles.controlButton}
              menuClassName={styles.menu}
              iconSize={18}
              iconStyle="calendar"
              open={visibilityMenuOpen}
              onOpenChange={(nextOpen) => {
                changeControlsMenu(nextOpen ? 'visibility' : null);
              }}
            />
          </div>
        )}
        <div ref={styleRef} className={styles.controlWrapper}>
          <button
            type="button"
            className={styles.controlButton}
            aria-label="Grid style"
            aria-expanded={styleMenuOpen}
            onClick={() =>
              changeControlsMenu(styleMenuOpen ? null : 'settings')
            }
          >
            <svg
              width="16"
              height="16"
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
          {styleMenuOpen && (
            <div className={styles.menu}>
              <div className={styles.menuLabel}>Grid style</div>
              {gridStyleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.menuItem}
                  data-active={gridStyle === option.value || undefined}
                  onClick={() => {
                    setGridStyle(option.value);
                    changeControlsMenu(null);
                  }}
                >
                  <span>{option.label}</span>
                  {gridStyle === option.value && <MenuCheckIcon />}
                </button>
              ))}
              <div className={styles.menuDivider} aria-hidden="true" />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => setHideConflictWarnings(!hideConflictWarnings)}
              >
                <span className={styles.menuItemLabel}>
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
                {hideConflictWarnings && <MenuCheckIcon />}
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showCalendarColorPalette}
                className={styles.menuItem}
                onClick={() => {
                  const nextShow = !showCalendarColorPalette;
                  setShowCalendarColorPalette(nextShow);
                  if (!nextShow) setOpenColorMenuCrn(null);
                }}
              >
                <span className={styles.menuItemLabel}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 1.1-3.22 1.8 1.8 0 0 1 1.1-3.22H18A3 3 0 0 0 21 11.5 8.6 8.6 0 0 0 12 3Z" />
                    <circle cx="8" cy="10" r="1" fill="currentColor" />
                    <circle cx="11" cy="7" r="1" fill="currentColor" />
                    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
                  </svg>
                  Show color palette
                </span>
                {showCalendarColorPalette && <MenuCheckIcon />}
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showCalendarNowLine}
                className={styles.menuItem}
                onClick={() => setShowCalendarNowLine(!showCalendarNowLine)}
              >
                <span className={styles.menuItemLabel}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <circle cx="8" cy="12" r="2" fill="currentColor" />
                  </svg>
                  Show current time indicator
                </span>
                {showCalendarNowLine && <MenuCheckIcon />}
              </button>
              {canEdit && (courses.length > 0 || clearedSnapshot) && (
                <>
                  <div className={styles.menuDivider} aria-hidden="true" />
                  {confirmClear ? (
                    <div className={styles.confirmBlock}>
                      <div className={styles.confirmText}>
                        Remove all {courses.length}{' '}
                        {courses.length === 1 ? 'course' : 'courses'} from this
                        worksheet?
                      </div>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.confirmClearButton}
                          onClick={() => {
                            void clearAllCourses();
                          }}
                        >
                          Clear all
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
                      className={styles.menuDangerItem}
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
                      className={styles.menuRestoreItem}
                      onClick={() => {
                        void restoreAllCourses();
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
          )}
        </div>
        <div ref={exportRef} className={styles.controlWrapper}>
          <button
            type="button"
            className={styles.controlButton}
            aria-label="Export worksheet"
            aria-expanded={exportMenuOpen}
            onClick={() => {
              changeControlsMenu(exportMenuOpen ? null : 'export');
            }}
          >
            <svg
              width="17"
              height="17"
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
            <div className={styles.menuRight}>
              <a
                className={styles.menuItem}
                href={icsExport.href}
                download={icsExport.download}
                onClick={(e) => {
                  icsExport.onClick(e);
                  changeControlsMenu(null);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
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
                className={styles.menuItem}
                disabled={isExportingPNG}
                onClick={() => {
                  void exportPNG().finally(() => changeControlsMenu(null));
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {isExportingPNG
                  ? worksheetExportMenuCopy.exportingPng
                  : worksheetExportMenuCopy.png}
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  void urlExport();
                  changeControlsMenu(null);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
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
          )}
        </div>
      </div>

      {visibleCourses.length > 0 && (
        <div className={styles.expandAllRow}>
          <button
            type="button"
            className={styles.expandAllButton}
            onClick={toggleExpandAll}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.expandAllChevron}
              data-open={allExpanded || undefined}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      <div className={styles.courseList}>
        {visibleCourses.map((course) => {
          const partners = conflictPartners.get(course.listing.crn);
          return (
            <CourseCard
              key={course.listing.crn}
              course={course}
              canEdit={canEdit}
              hasConflict={Boolean(partners) && !hideConflictWarnings}
              conflictTooltip={
                partners ? `Conflicts with ${[...partners].join(', ')}` : null
              }
              expanded={expandedCards.has(course.listing.crn)}
              colorMenuOpen={openColorMenuCrn === course.listing.crn}
              showColorPalette={showCalendarColorPalette}
              onToggleExpand={() => toggleCardExpanded(course.listing.crn)}
              onColorMenuOpenChange={(open) =>
                setOpenColorMenuCrn(open ? course.listing.crn : null)
              }
              onRemove={(c) => {
                void removeCourse(c);
              }}
            />
          );
        })}
        {courses.length === 0 && (
          <div className={styles.emptyList}>
            <img
              alt=""
              aria-hidden="true"
              src={noCoursesImg}
              className={styles.emptyListImage}
            />
            <p className={styles.emptyListTitle}>Nothing planned yet</p>
            <p className={styles.emptyListHint}>
              Courses you add from the catalog will show up here.
            </p>
            <Link to={createCatalogLink()} className={styles.emptyListButton}>
              Browse Catalog
            </Link>
          </div>
        )}
      </div>

      {conflictModalOpen && (
        <ConflictModal
          conflicts={visibleConflicts}
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
    </div>
  );
}
