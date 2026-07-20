import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { buildWorksheetItemMeetings } from './worksheetListMeetings';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { getWorksheetColorAppearance } from '../../utilities/constants';
import styles from './ExamsModal.module.css';

function sectionOf(course: WorksheetCourse) {
  const details = (
    course.listing.course as {
      ucsd_calendar?: { section_code?: string | null };
    }
  ).ucsd_calendar;
  return details?.section_code ?? course.listing.course.section;
}

export default function ExamsModal({
  courses,
  onClose,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly onClose: () => void;
}) {
  const theme = useStore((state) => state.theme);
  const [sortBy, setSortBy] = useState<'date' | 'course'>('date');

  // The caller supplies only courses currently visible in the worksheet.
  const exams = useMemo(() => {
    const list = [];
    for (const course of courses) {
      const { dated } = buildWorksheetItemMeetings(course.listing);
      for (const meeting of dated) {
        if (meeting.tone === 'neutral') continue;
        list.push({
          crn: course.listing.crn,
          code: course.listing.course_code,
          section: sectionOf(course),
          title: course.listing.course.title,
          color: course.color,
          tone: meeting.tone,
          kind: meeting.kind,
          date: meeting.dateLabel,
          timeLocation: [
            meeting.time === 'TBA' ? '' : meeting.time,
            meeting.location,
          ]
            .filter(Boolean)
            .join(' · '),
          daysUntil: meeting.daysUntil,
        });
      }
    }
    return list;
  }, [courses]);

  const sorted = useMemo(() => {
    const list = [...exams];
    if (sortBy === 'course') {
      list.sort(
        (a, b) =>
          a.code.localeCompare(b.code) ||
          (a.daysUntil ?? 0) - (b.daysUntil ?? 0),
      );
    } else {
      list.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
    }
    return list;
  }, [exams, sortBy]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop}>
      <button
        type="button"
        className={styles.backdropButton}
        aria-label="Close"
        onClick={onClose}
      />
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- overlay dialog with custom backdrop, not a native <dialog> */}
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Exams"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Exams</span>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className={styles.subtitleRow}>
            <span className={styles.subtitle}>
              {exams.length} {exams.length === 1 ? 'exam' : 'exams'}
            </span>
            <div className={styles.sortToggle}>
              <button
                type="button"
                className={styles.sortButton}
                data-active={sortBy === 'date' || undefined}
                aria-pressed={sortBy === 'date'}
                onClick={() => setSortBy('date')}
              >
                Date
              </button>
              <button
                type="button"
                className={styles.sortButton}
                data-active={sortBy === 'course' || undefined}
                aria-pressed={sortBy === 'course'}
                onClick={() => setSortBy('course')}
              >
                Course
              </button>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {sorted.map((exam, i) => (
            <div
              key={`${exam.crn}-${exam.tone}-${i}`}
              className={styles.examRow}
              data-last={i === sorted.length - 1 || undefined}
            >
              <div className={styles.codeRow}>
                <span
                  className={styles.colorDot}
                  style={{
                    background: getWorksheetColorAppearance(exam.color, theme)
                      .primary,
                  }}
                  aria-hidden="true"
                />
                <span className={styles.code}>{exam.code}</span>
                <span className={styles.section}>{exam.section}</span>
              </div>
              <div className={styles.courseTitle}>{exam.title}</div>
              <div className={styles.kindRow}>
                <span className={styles.kindBadge} data-tone={exam.tone}>
                  {exam.tone === 'final' ? 'FI' : 'MI'}
                </span>
                <span className={styles.kindLabel} data-tone={exam.tone}>
                  {exam.kind}
                </span>
              </div>
              <div className={styles.date}>{exam.date}</div>
              <div className={styles.timeLocation}>{exam.timeLocation}</div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className={styles.empty}>No exams scheduled</div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.gotIt} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
