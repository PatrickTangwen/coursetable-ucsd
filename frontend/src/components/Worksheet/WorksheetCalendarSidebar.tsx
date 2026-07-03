import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import chroma from 'chroma-js';
import { useShallow } from 'zustand/react/shallow';

import { getQuickModalData } from './CalendarQuickModal';
import { useICSExport } from './ICSExportButton';
import { useWorksheetURLExport } from './URLExportButton';
import { useToggleCourseHidden } from './WorksheetHideButton';
import {
  isLegacyUserInfo,
  setCourseHidden,
  updateWorksheetCourses,
  type SavedWorksheetSummary,
} from '../../queries/api';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { getWorksheetCourseStats } from '../../utilities/course';
import styles from './WorksheetCalendarSidebar.module.css';

const statPillScale = chroma.scale(['#eaf3de', '#faeeda', '#fcebeb']);

function statPillColor(value: number, domain: [number, number]) {
  return statPillScale.domain(domain)(value).hex();
}

function sectionOf(course: WorksheetCourse) {
  const details = (
    course.listing.course as {
      ucsd_calendar?: { section_code?: string | null };
    }
  ).ucsd_calendar;
  return details?.section_code ?? course.listing.course.section;
}

function useCloseOnOutsideClick(
  open: boolean,
  close: () => void,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, close]);
  return ref;
}

function WorksheetHeader() {
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
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const rootRef = useCloseOnOutsideClick(open, () => {
    setOpen(false);
    setEditingId(null);
  });

  if (!activeSavedWorksheet) return null;

  const termWorksheets = savedWorksheetSummaries
    .filter((summary) => summary.term === viewedSeason)
    .sort(
      (a, b) =>
        Number(b.isMain) - Number(a.isMain) || b.createdAt - a.createdAt,
    );

  const confirmRename = async () => {
    if (editingId === null) return;
    const name = editingName.trim();
    if (name) await renameSavedWorksheet(editingId, name);
    setEditingId(null);
    setEditingName('');
  };

  const renderRow = (summary: SavedWorksheetSummary) => {
    if (editingId === summary.id) {
      return (
        <div key={summary.id} className={styles.wsEditRow}>
          <input
            className={styles.wsEditInput}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmRename();
              } else if (e.key === 'Escape') {
                setEditingId(null);
              }
            }}
            aria-label="Worksheet name"
          />
          <button
            type="button"
            className={styles.wsEditConfirm}
            aria-label="Save name"
            onClick={() => {
              void confirmRename();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.wsEditCancel}
            aria-label="Cancel rename"
            onClick={() => setEditingId(null)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      );
    }
    const isActive = summary.id === activeSavedWorksheet.id;
    return (
      <div
        key={summary.id}
        className={styles.wsRow}
        data-active={isActive || undefined}
      >
        <button
          type="button"
          className={styles.wsRowMain}
          onClick={() => {
            void selectSavedWorksheet(summary.id);
            setOpen(false);
          }}
        >
          <span className={styles.wsRowIcon} aria-hidden="true">
            {summary.isMain ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
              </svg>
            )}
          </span>
          <span className={styles.wsRowInfo}>
            <span className={styles.wsRowName}>{summary.name}</span>
            <span className={styles.wsRowSubtitle}>
              {summary.isMain ? 'Main Worksheet' : 'Private Saved Worksheet'}
            </span>
          </span>
        </button>
        {!summary.isMain && (
          <>
            <button
              type="button"
              className={styles.wsIconButton}
              aria-label={`Rename ${summary.name}`}
              onClick={() => {
                setEditingId(summary.id);
                setEditingName(summary.name);
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.wsIconButtonDanger}
              aria-label={`Delete ${summary.name}`}
              onClick={() => {
                void deleteSavedWorksheet(summary.id);
              }}
            >
              <svg
                width="15"
                height="15"
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
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={styles.worksheetHeader}
      data-open={open || undefined}
    >
      <button
        type="button"
        className={styles.worksheetToggle}
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
      >
        <span className={styles.worksheetStar} aria-hidden="true">
          ★
        </span>
        <span className={styles.worksheetName}>
          {activeSavedWorksheet.name}
        </span>
        <svg
          width="9"
          height="5"
          viewBox="0 0 10 6"
          fill="none"
          className={styles.worksheetChevron}
          data-open={open || undefined}
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
      {open && (
        <div className={styles.worksheetMenu}>
          {termWorksheets.map(renderRow)}
          <div className={styles.wsDivider} />
          <button
            type="button"
            className={styles.wsNewButton}
            onClick={() => {
              void createBlankSavedWorksheetForTerm(viewedSeason);
              setOpen(false);
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
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Worksheet
          </button>
        </div>
      )}
    </div>
  );
}

function CourseCard({
  course,
  canEdit,
  onRemove,
}: {
  readonly course: WorksheetCourse;
  readonly canEdit: boolean;
  readonly onRemove: (course: WorksheetCourse) => void;
}) {
  const { hoverCourse, setHoverCourse } = useStore(
    useShallow((s) => ({
      hoverCourse: s.hoverCourse,
      setHoverCourse: s.setHoverCourse,
    })),
  );
  const toggleCourseHidden = useToggleCourseHidden();
  const [, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const { crn } = course.listing;
  const hidden = Boolean(course.hidden);
  const { exams } = useMemo(
    () => getQuickModalData(course.listing, null),
    [course.listing],
  );
  const section = sectionOf(course);

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
      className={styles.card}
      data-hovered={(hoverCourse === crn && !expanded) || undefined}
      data-expanded={expanded || undefined}
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
          style={{ background: course.color, opacity: hidden ? 0.3 : 1 }}
          aria-hidden="true"
        />
        <div className={styles.cardInfo} data-hidden={hidden || undefined}>
          <span className={styles.cardCodeLine}>
            <strong className={styles.cardCode}>
              {course.listing.course_code}
            </strong>
            {section && <span className={styles.cardSection}> {section}</span>}
          </span>
          <span className={styles.cardTitle}>
            {course.listing.course.title}
          </span>
        </div>
        {canEdit && toggleCourseHidden && (
          <button
            type="button"
            className={styles.cardEyeButton}
            aria-label={hidden ? 'Show in calendar' : 'Hide from calendar'}
            onClick={(e) => {
              e.stopPropagation();
              void toggleCourseHidden(crn, hidden);
            }}
          >
            {hidden ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9f9d97"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0b0b0b"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
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
            setExpanded((x) => !x);
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
      {expanded && (
        <div className={styles.cardDetails}>
          {exams.length === 0 && (
            <div className={styles.examEntry}>
              <span
                className={styles.examDot}
                style={{ background: course.color }}
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
                style={{ background: course.color }}
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
    gridStyle,
    setGridStyle,
    setAllAnonymousWorksheetHidden,
    setAllActiveSavedWorksheetHidden,
    removeAnonymousWorksheetListing,
    removeActiveSavedWorksheetListing,
    worksheetsRefresh,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      gridStyle: state.calendarGridStyle,
      setGridStyle: state.setCalendarGridStyle,
      setAllAnonymousWorksheetHidden: state.setAllAnonymousWorksheetHidden,
      setAllActiveSavedWorksheetHidden: state.setAllActiveSavedWorksheetHidden,
      removeAnonymousWorksheetListing: state.removeAnonymousWorksheetListing,
      removeActiveSavedWorksheetListing:
        state.removeActiveSavedWorksheetListing,
      worksheetsRefresh: state.worksheetsRefresh,
    })),
  );
  const toggleCourseHidden = useToggleCourseHidden();
  const canEdit = toggleCourseHidden !== null;
  const hasSavedWorksheetAccount = Boolean(user && !isLegacyUserInfo(user));
  const icsExport = useICSExport();
  const urlExport = useWorksheetURLExport();

  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const styleRef = useCloseOnOutsideClick(styleMenuOpen, () =>
    setStyleMenuOpen(false),
  );
  const exportRef = useCloseOnOutsideClick(exportMenuOpen, () =>
    setExportMenuOpen(false),
  );

  const { courseCount, credits } = useMemo(
    () => getWorksheetCourseStats(courses),
    [courses],
  );
  const areHidden = courses.length > 0 && courses.every((c) => c.hidden);

  const toggleAllHidden = async () => {
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
      crn: courses.map((c) => c.listing.crn),
      hidden: !areHidden,
    });
    await worksheetsRefresh();
  };

  const removeCourse = async (course: WorksheetCourse) => {
    if (isAnonymousWorksheet) {
      removeAnonymousWorksheetListing(course.listing);
      return;
    }
    if (hasSavedWorksheetAccount) {
      await removeActiveSavedWorksheetListing(course.listing);
      return;
    }
    const success = await updateWorksheetCourses({
      action: 'remove',
      season: viewedSeason,
      crn: course.listing.crn,
      worksheetNumber: viewedWorksheetNumber,
      color: course.color,
      hidden: false,
    });
    if (success) await worksheetsRefresh();
  };

  const gridStyleOptions = [
    { value: 'paper', label: 'Paper' },
    { value: 'embossed', label: 'Embossed' },
    { value: 'colorBar', label: 'Color bar' },
  ] as const;

  return (
    <div className={styles.sidebar}>
      {hasSavedWorksheetAccount && <WorksheetHeader />}

      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={styles.statLabel}>Courses</div>
          <div
            className={styles.statValue}
            style={{ background: statPillColor(courseCount, [4, 6]) }}
          >
            {courseCount}
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={styles.statLabel}>Credits</div>
          <div
            className={styles.statValue}
            style={{ background: statPillColor(credits, [4, 16]) }}
          >
            {credits}
          </div>
        </div>
      </div>

      <div className={styles.controlsRow}>
        {canEdit && (
          <button
            type="button"
            className={styles.controlButton}
            aria-label={areHidden ? 'Show all courses' : 'Hide all courses'}
            onClick={() => {
              void toggleAllHidden();
            }}
          >
            {areHidden ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9f9d97"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
        <div ref={styleRef} className={styles.controlWrapper}>
          <button
            type="button"
            className={styles.controlButton}
            aria-label="Grid style"
            aria-expanded={styleMenuOpen}
            onClick={() => setStyleMenuOpen((x) => !x)}
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
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
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
                    setStyleMenuOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {gridStyle === option.value && (
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
              ))}
            </div>
          )}
        </div>
        <div ref={exportRef} className={styles.controlWrapper}>
          <button
            type="button"
            className={styles.controlButton}
            aria-label="Export worksheet"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((x) => !x)}
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
                  setExportMenuOpen(false);
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
                Export as .ics file
              </a>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  void urlExport();
                  setExportMenuOpen(false);
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
                Copy shareable URL
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.courseList}>
        {courses.map((course) => (
          <CourseCard
            key={course.listing.crn}
            course={course}
            canEdit={canEdit}
            onRemove={(c) => {
              void removeCourse(c);
            }}
          />
        ))}
        {courses.length === 0 && (
          <div className={styles.emptyList}>
            No courses yet — add some from the Catalog.
          </div>
        )}
      </div>
    </div>
  );
}
