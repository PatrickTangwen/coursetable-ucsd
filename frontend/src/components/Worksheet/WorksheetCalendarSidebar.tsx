import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import chroma from 'chroma-js';
import { useShallow } from 'zustand/react/shallow';

import { getQuickModalData } from './CalendarQuickModal';
import { useICSExport } from './ICSExportButton';
import { useWorksheetURLExport } from './URLExportButton';
import { useToggleCourseHidden } from './WorksheetHideButton';
import WorksheetPicker, { useCloseOnOutsideClick } from './WorksheetPicker';
import noCoursesImg from '../../images/calendar_img_high_res.png';
import {
  isLegacyUserInfo,
  setCourseHidden,
  updateWorksheetCourses,
} from '../../queries/api';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { getWorksheetCourseStats } from '../../utilities/course';
import { createCatalogLink } from '../../utilities/navigation';
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

  return (
    <WorksheetPicker
      viewedSeason={viewedSeason}
      activeSavedWorksheet={activeSavedWorksheet}
      savedWorksheetSummaries={savedWorksheetSummaries}
      selectSavedWorksheet={selectSavedWorksheet}
      createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
      renameSavedWorksheet={renameSavedWorksheet}
      deleteSavedWorksheet={deleteSavedWorksheet}
    />
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
    </div>
  );
}
