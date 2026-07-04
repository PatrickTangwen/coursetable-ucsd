import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { buildWorksheetItemMeetings } from './worksheetListMeetings';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import styles from './FinalsModal.module.css';

function sectionOf(course: WorksheetCourse) {
  const details = (
    course.listing.course as {
      ucsd_calendar?: { section_code?: string | null };
    }
  ).ucsd_calendar;
  return details?.section_code ?? course.listing.course.section;
}

export default function FinalsModal({
  courses,
  onClose,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly onClose: () => void;
}) {
  // All finals across every course (hidden included), sorted soonest-first.
  const finals = useMemo(() => {
    const list = [];
    for (const course of courses) {
      const { dated } = buildWorksheetItemMeetings(course.listing);
      for (const meeting of dated) {
        if (meeting.tone !== 'final') continue;
        list.push({
          crn: course.listing.crn,
          code: course.listing.course_code,
          section: sectionOf(course),
          title: course.listing.course.title,
          color: course.color,
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
    list.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
    return list;
  }, [courses]);

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
        aria-label="Final exams"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Final exams</span>
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
          <div className={styles.subtitle}>
            {finals.length} {finals.length === 1 ? 'final exam' : 'final exams'}{' '}
            · sorted by date
          </div>
        </div>

        <div className={styles.body}>
          {finals.map((exam, i) => (
            <div
              key={`${exam.crn}-${i}`}
              className={styles.finalRow}
              data-last={i === finals.length - 1 || undefined}
            >
              <div className={styles.codeRow}>
                <span
                  className={styles.colorDot}
                  style={{ background: exam.color }}
                  aria-hidden="true"
                />
                <span className={styles.code}>{exam.code}</span>
                <span className={styles.section}>{exam.section}</span>
              </div>
              <div className={styles.courseTitle}>{exam.title}</div>
              <div className={styles.kindRow}>
                <span className={styles.kindBadge}>FI</span>
                <span className={styles.kindLabel}>Final Exam</span>
              </div>
              <div className={styles.date}>{exam.date}</div>
              <div className={styles.timeLocation}>{exam.timeLocation}</div>
            </div>
          ))}
          {finals.length === 0 && (
            <div className={styles.empty}>No final exams scheduled</div>
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
