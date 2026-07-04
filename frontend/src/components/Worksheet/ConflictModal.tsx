import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { weekdays } from '../../utilities/constants';
import {
  formatMinuteRange,
  type ScheduleConflict,
} from '../../utilities/scheduleConflicts';
import { ucsdMeetingTypeCode } from '../CourseModal/ucsdMeetingTypes';
import styles from './ConflictModal.module.css';

const mondayFirstDays = [
  weekdays.Monday,
  weekdays.Tuesday,
  weekdays.Wednesday,
  weekdays.Thursday,
  weekdays.Friday,
  weekdays.Saturday,
  weekdays.Sunday,
];
const fullDayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatConflictDaysFull(mask: number): string {
  return mondayFirstDays
    .filter((day) => mask & (1 << day))
    .map((day) => fullDayNames[day])
    .join(', ');
}

function formatConflictDateFull(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function sectionOf(course: WorksheetCourse) {
  const details = (
    course.listing.course as {
      ucsd_calendar?: { section_code?: string | null };
    }
  ).ucsd_calendar;
  return details?.section_code ?? course.listing.course.section;
}

function isFinalMeeting(meetingType: string) {
  return ucsdMeetingTypeCode(meetingType) === 'FI';
}

export default function ConflictModal({
  conflicts,
  courses,
  onClose,
}: {
  readonly conflicts: readonly ScheduleConflict[];
  readonly courses: readonly WorksheetCourse[];
  readonly onClose: () => void;
}) {
  const sectionByCrn = useMemo(() => {
    const map = new Map<Crn, string>();
    for (const course of courses)
      map.set(course.listing.crn, sectionOf(course));
    return map;
  }, [courses]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const examCount = conflicts.filter((c) => c.date !== null).length;
  const timeCount = conflicts.length - examCount;
  const breakdown = [
    timeCount ? `${timeCount} time` : '',
    examCount ? `${examCount} final` : '',
  ]
    .filter(Boolean)
    .join(' · ');

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
        aria-label="Schedule conflicts"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Schedule conflicts</span>
            <div className={styles.titleAside}>
              <span className={styles.countLabel}>
                {conflicts.length}{' '}
                {conflicts.length === 1 ? 'conflict' : 'conflicts'}
              </span>
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
          </div>
          <div className={styles.subtitle}>
            {conflicts.length} {conflicts.length === 1 ? 'issue' : 'issues'} in
            this worksheet{breakdown ? ` · ${breakdown}` : ''}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.listCard}>
            {conflicts.map((conflict, i) => {
              const isExam = conflict.date !== null;
              const bothFinal =
                isExam &&
                isFinalMeeting(conflict.a.meetingType) &&
                isFinalMeeting(conflict.b.meetingType);
              const sameSlot =
                conflict.a.startMin === conflict.b.startMin &&
                conflict.a.endMin === conflict.b.endMin;
              const overlapMin =
                conflict.overlapEndMin - conflict.overlapStartMin;
              const whenPrefix =
                conflict.date !== null
                  ? formatConflictDateFull(conflict.date)
                  : formatConflictDaysFull(conflict.sharedDays);
              return (
                <div
                  key={`${conflict.a.crn}-${conflict.a.meetingIndex}-${conflict.b.crn}-${conflict.b.meetingIndex}`}
                  className={styles.conflictRow}
                  data-last={i === conflicts.length - 1 || undefined}
                >
                  <div className={styles.rowTop}>
                    <span className={styles.kindLabel}>
                      {isExam
                        ? bothFinal
                          ? 'FINAL EXAM'
                          : 'EXAM OVERLAP'
                        : 'TIME CONFLICT'}
                    </span>
                    <span
                      className={styles.overlapChip}
                      data-final={bothFinal || undefined}
                    >
                      {sameSlot
                        ? isExam
                          ? 'Same exam slot'
                          : 'Same time slot'
                        : `${overlapMin} min overlap`}
                    </span>
                  </div>
                  <div className={styles.coursesLine}>
                    <span
                      className={styles.colorChip}
                      style={{ background: conflict.a.color }}
                    />
                    <b className={styles.courseCode}>{conflict.a.courseCode}</b>
                    <span className={styles.courseSection}>
                      {sectionByCrn.get(conflict.a.crn) ?? ''}
                    </span>
                    <span className={styles.vs}>vs</span>
                    <span
                      className={styles.colorChip}
                      style={{ background: conflict.b.color }}
                    />
                    <b className={styles.courseCode}>{conflict.b.courseCode}</b>
                    <span className={styles.courseSection}>
                      {sectionByCrn.get(conflict.b.crn) ?? ''}
                    </span>
                  </div>
                  <div className={styles.whenLine}>
                    {whenPrefix} · overlap{' '}
                    <b className={styles.whenBold}>
                      {formatMinuteRange(
                        conflict.overlapStartMin,
                        conflict.overlapEndMin,
                      )}
                    </b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerNote}>
            Conflicts don't block enrolling. Please follow your course
            instructor's policies and instructions.
          </span>
          <button type="button" className={styles.gotIt} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
