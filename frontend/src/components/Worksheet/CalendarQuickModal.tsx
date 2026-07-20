import { useEffect, useMemo } from 'react';
import chroma from 'chroma-js';
import { createPortal } from 'react-dom';

import type {
  WorksheetListingViewModel,
  WorksheetMeeting,
} from '../../types/worksheetCourse';
import { getWorksheetColorToken, weekdays } from '../../utilities/constants';
import {
  describeConflictSlot,
  type CourseConflict,
} from '../../utilities/scheduleConflicts';
import styles from './CalendarQuickModal.module.css';

const dayAbbreviations = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
const mondayFirstDays = [1, 2, 3, 4, 5, 6, 0];

type QuickMeeting = {
  key: string;
  typeCode: string;
  days: string;
  time: string;
  location: string;
  isViewing: boolean;
};

type QuickExam = {
  key: string;
  kind: string;
  typeCode: string;
  date: string;
  meta: string;
  badge: { label: string; tone: 'past' | 'soon' | 'upcoming' | 'later' };
};

type ExtendedMeeting = WorksheetMeeting & {
  date?: string | null;
  meeting_type?: string | null;
  raw_location?: string | null;
};

function typeCodeOf(type: string): string {
  const map: { [type: string]: string } = {
    Lecture: 'LE',
    Discussion: 'DI',
    Laboratory: 'LA',
    Lab: 'LA',
    Seminar: 'SE',
    Final: 'FI',
    Midterm: 'MI',
  };
  return map[type] ?? (type ? type.slice(0, 2).toUpperCase() : 'OT');
}

function meetingTypeOf(
  listing: WorksheetListingViewModel,
  meeting: ExtendedMeeting,
) {
  const details = (
    listing.course as { ucsd_calendar?: { meeting_type?: string | null } }
  ).ucsd_calendar;
  return meeting.meeting_type || details?.meeting_type || 'Meeting';
}

function meetingLocationOf(meeting: ExtendedMeeting) {
  if (meeting.location) {
    return `${meeting.location.building.code}${
      meeting.location.room ? ` ${meeting.location.room}` : ''
    }`;
  }
  return meeting.raw_location ?? '';
}

function minutesOfClock(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function formatClock(time: string): string {
  const [hourRaw, minute] = time.split(':').map(Number);
  const hour = hourRaw ?? 0;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minute ?? 0).padStart(2, '0')} ${period}`;
}

function formatClockRange(start: string, end: string): string {
  return `${formatClock(start)} – ${formatClock(end)}`;
}

function examBadge(examDate: Date): QuickExam['badge'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(examDate);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: 'Past', tone: 'past' };
  if (days === 0) return { label: 'Today', tone: 'soon' };
  if (days <= 7)
    return { label: `In ${days} day${days === 1 ? '' : 's'}`, tone: 'soon' };
  if (days <= 60) {
    const weeks = Math.max(1, Math.round(days / 7));
    return {
      label: `In ${weeks} week${weeks === 1 ? '' : 's'}`,
      tone: 'upcoming',
    };
  }
  const months = Math.max(2, Math.round(days / 30));
  return { label: `In ${months} months`, tone: 'later' };
}

export function getQuickModalData(
  listing: WorksheetListingViewModel,
  viewingKey: string | null,
): { meetings: QuickMeeting[]; exams: QuickExam[] } {
  const groups = new Map<
    string,
    {
      type: string;
      start: string;
      end: string;
      location: string;
      days: Set<number>;
    }
  >();
  const exams: QuickExam[] = [];

  for (const raw of listing.course.course_meetings) {
    const meeting = raw as ExtendedMeeting;
    if (!meeting.start_time || !meeting.end_time) continue;
    const type = meetingTypeOf(listing, meeting);
    const location = meetingLocationOf(meeting);

    if (meeting.date) {
      if (type !== 'Final' && type !== 'Midterm') continue;
      const dateObj = new Date(`${meeting.date}T00:00:00`);
      exams.push({
        key: `${type}-${meeting.date}-${meeting.start_time}`,
        kind: type === 'Final' ? 'Final Exam' : 'Midterm',
        typeCode: typeCodeOf(type),
        date: `${dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} · ${formatClock(meeting.start_time)}`,
        meta: [formatClockRange(meeting.start_time, meeting.end_time), location]
          .filter(Boolean)
          .join(' · '),
        badge: examBadge(dateObj),
      });
      continue;
    }

    const days = Object.values(weekdays).filter(
      (day) => raw.days_of_week & (1 << day),
    );
    if (days.length === 0) continue;
    const key = `${type}|${minutesOfClock(meeting.start_time)}|${minutesOfClock(meeting.end_time)}|${location}`;
    const group = groups.get(key) ?? {
      type,
      start: meeting.start_time,
      end: meeting.end_time,
      location,
      days: new Set<number>(),
    };
    for (const day of days) group.days.add(day);
    groups.set(key, group);
  }

  const meetings = [...groups.entries()].map(([key, group]) => ({
    key,
    typeCode: typeCodeOf(group.type),
    days: mondayFirstDays
      .filter((day) => group.days.has(day))
      .map((day) => dayAbbreviations[day])
      .join(''),
    time: formatClockRange(group.start, group.end),
    location: group.location || 'TBA',
    isViewing: viewingKey !== null && key === viewingKey,
  }));

  exams.sort((a, b) => a.key.localeCompare(b.key));
  return { meetings, exams };
}

const badgeToneClass = {
  past: styles.badgePast,
  soon: styles.badgeSoon,
  upcoming: styles.badgeUpcoming,
  later: styles.badgeLater,
};

function TypeBadge({ code }: { readonly code: string }) {
  const toneClass =
    code === 'LE'
      ? styles.typeLecture
      : code === 'DI'
        ? styles.typeDiscussion
        : code === 'LA'
          ? styles.typeLab
          : code === 'FI'
            ? styles.typeFinal
            : code === 'MI'
              ? styles.typeMidterm
              : styles.typeOther;
  return <span className={`${styles.typeBadge} ${toneClass}`}>{code}</span>;
}

export default function CalendarQuickModal({
  listing,
  color,
  viewingKey,
  conflicts = [],
  onClose,
}: {
  readonly listing: WorksheetListingViewModel;
  readonly color: string;
  readonly viewingKey: string | null;
  readonly conflicts?: readonly CourseConflict[];
  readonly onClose: () => void;
}) {
  const { meetings, exams } = useMemo(
    () => getQuickModalData(listing, viewingKey),
    [listing, viewingKey],
  );
  const { credits } = listing.course;
  const section =
    (listing.course as { ucsd_calendar?: { section_code?: string | null } })
      .ucsd_calendar?.section_code ?? listing.course.section;

  const unitsChip = useMemo(() => {
    const preset = getWorksheetColorToken(color);
    if (preset) return { background: preset.soft, color: preset.deep };

    const base = chroma.valid(color) ? chroma(color) : chroma('#378add');
    return {
      background: chroma.mix(base, '#ffffff', 0.85).hex(),
      color: base.darken(2).hex(),
    };
  }, [color]);

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
        aria-label={`${listing.course_code} meetings`}
      >
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.titleRow}>
              <span className={styles.colorDot} style={{ background: color }} />
              <span className={styles.code}>{listing.course_code}</span>
              {section && <span className={styles.section}>{section}</span>}
            </div>
            <div className={styles.courseTitle}>{listing.course.title}</div>
            {credits !== null && (
              <div className={styles.unitsChip} style={unitsChip}>
                {credits} {credits === 1 ? 'Unit' : 'Units'}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>
        {conflicts.length > 0 && (
          <div className={styles.sectionBlock}>
            <div className={styles.sectionLabel}>Schedule conflicts</div>
            <div className={styles.conflictCard}>
              {conflicts.map((conflict, i) => (
                <div
                  key={`${conflict.other.crn}-${conflict.own.meetingIndex}-${conflict.other.meetingIndex}`}
                  className={styles.conflictRow}
                  data-last={i === conflicts.length - 1 || undefined}
                >
                  <svg
                    width="13"
                    height="13"
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
                  <span className={styles.conflictText}>
                    {conflict.own.meetingType} overlaps{' '}
                    <strong>{conflict.other.courseCode}</strong>{' '}
                    {conflict.other.meetingType} ·{' '}
                    {describeConflictSlot(conflict)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionLabel}>Meetings</div>
          <div className={styles.listCard}>
            {meetings.length === 0 && (
              <div className={styles.emptyRow}>No scheduled meetings</div>
            )}
            {meetings.map((meeting, i) => (
              <div
                key={meeting.key}
                className={styles.meetingRow}
                data-last={i === meetings.length - 1 || undefined}
              >
                <span className={styles.badgeAnchor}>
                  <TypeBadge code={meeting.typeCode} />
                  {meeting.isViewing && <span className={styles.viewingDot} />}
                </span>
                <span className={styles.meetingDays}>{meeting.days}</span>
                <span className={styles.meetingTime}>{meeting.time}</span>
                <span className={styles.meetingLocation}>
                  {meeting.location}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.sectionBlock}>
          <div className={styles.sectionLabel}>Exams</div>
          <div className={styles.listCard}>
            {exams.length === 0 && (
              <div className={styles.emptyRow}>
                No final or midterm scheduled
              </div>
            )}
            {exams.map((exam, i) => (
              <div
                key={exam.key}
                className={styles.examRow}
                data-last={i === exams.length - 1 || undefined}
              >
                <div className={styles.examKindRow}>
                  <TypeBadge code={exam.typeCode} />
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
                    className={`${styles.examBadge} ${badgeToneClass[exam.badge.tone]}`}
                  >
                    {exam.badge.label}
                  </span>
                </div>
                <div className={styles.examDate}>{exam.date}</div>
                <div className={styles.examMeta}>{exam.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
