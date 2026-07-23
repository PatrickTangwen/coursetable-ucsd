import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { FiChevronDown } from 'react-icons/fi';

import { WorksheetColorMenuButton } from './WorksheetCourseMenus';
import {
  buildWorksheetItemMeetings,
  countdownLabel,
  countdownSeverity,
  listDayLabels,
  type ListDayFlags,
  type WorksheetDatedMeeting,
  type WorksheetItemMeetings,
} from './worksheetListMeetings';
import WorksheetViewModelRemoveButton, {
  useRemoveWorksheetListing,
} from './WorksheetViewModelRemoveButton';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { getWorksheetColorAppearance } from '../../utilities/constants';
import { formatWorksheetSectionSuffix } from '../../utilities/course';
import { useCourseModalLink } from '../../utilities/display';
import {
  describeConflictSlot,
  describeCourseConflict,
  type CourseConflict,
} from '../../utilities/scheduleConflicts';
import styles from './WorksheetListItem.module.css';

function ConflictTriangle({ size }: { readonly size: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  );
}

function ListDayDots({ days }: { readonly days: ListDayFlags }) {
  const hasWeekend = days.Sa || days.Su;
  const labels = hasWeekend ? listDayLabels : listDayLabels.slice(0, 5);
  return (
    <div className={styles.dayDots} aria-hidden="true">
      {labels.map((day) => (
        <span
          key={day}
          className={clsx(
            styles.dayDot,
            days[day] ? styles.dayDotActive : styles.dayDotInactive,
          )}
        >
          {day}
        </span>
      ))}
    </div>
  );
}

function CountdownBadge({ daysUntil }: { readonly daysUntil: number | null }) {
  const label = countdownLabel(daysUntil);
  if (!label) return null;
  const severity = countdownSeverity(daysUntil);
  return (
    <span
      className={clsx(
        styles.countdown,
        severity === 'past' && styles.countdownPast,
        severity === 'soon' && styles.countdownSoon,
        severity === 'upcoming' && styles.countdownUpcoming,
        severity === 'later' && styles.countdownLater,
      )}
    >
      {label}
    </span>
  );
}

// The swipe-revealed Remove zone spans a fifth of the card width (mirrored
// by .swipeRemoveButton's 20% width); dragging past 60% of the card width
// removes the course directly on release.
const swipeRevealFraction = 0.2;

function meetingMeta(meeting: { time: string; location: string }): string {
  return [meeting.time === 'TBA' ? '' : meeting.time, meeting.location]
    .filter(Boolean)
    .join(' · ');
}

function datedKindClass(meeting: WorksheetDatedMeeting): string | false {
  if (meeting.tone === 'midterm') return styles.kindMidterm!;
  if (meeting.tone === 'final') return styles.kindFinal!;
  return false;
}

export function WorksheetMeetingDetails({
  meetings,
  primaryColor,
  conflicts,
  footer,
}: {
  readonly meetings: WorksheetItemMeetings;
  readonly primaryColor: string;
  readonly conflicts: readonly CourseConflict[];
  readonly footer?: ReactNode;
}) {
  const { weekly, dated } = meetings;
  const conflictsByMeetingIndex = useMemo(() => {
    const map = new Map<number, CourseConflict[]>();
    for (const conflict of conflicts) {
      const list = map.get(conflict.own.meetingIndex) ?? [];
      list.push(conflict);
      map.set(conflict.own.meetingIndex, list);
    }
    return map;
  }, [conflicts]);

  return (
    <div className={styles.expandPanel}>
      {weekly.map((meeting, index) => (
        <div key={`weekly-${index}`} className={styles.meetingRow}>
          <span
            className={styles.meetingDot}
            style={{ backgroundColor: primaryColor }}
            aria-hidden="true"
          />
          <div>
            <div className={styles.meetingKindRow}>
              <span className={styles.meetingKind}>{meeting.kind}</span>
            </div>
            <div className={styles.meetingDate}>
              <ListDayDots days={meeting.days} />
            </div>
            {meetingMeta(meeting) && (
              <div className={styles.meetingMeta}>{meetingMeta(meeting)}</div>
            )}
            {(conflictsByMeetingIndex.get(meeting.meetingIndex) ?? []).map(
              (conflict, conflictIndex) => (
                <div key={conflictIndex} className={styles.meetingConflict}>
                  <ConflictTriangle size={11} />
                  Overlaps {conflict.other.courseCode}{' '}
                  {conflict.other.meetingType} ·{' '}
                  {describeConflictSlot(conflict)}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      {dated.map((meeting, index) => (
        <div key={`dated-${index}`} className={styles.meetingRow}>
          <span
            className={styles.meetingDot}
            style={{ backgroundColor: primaryColor }}
            aria-hidden="true"
          />
          <div>
            <div className={styles.meetingKindRow}>
              <span
                className={clsx(styles.meetingKind, datedKindClass(meeting))}
              >
                {meeting.kind}
              </span>
              <CountdownBadge daysUntil={meeting.daysUntil} />
            </div>
            <div className={styles.meetingDate}>{meeting.dateLabel}</div>
            {meetingMeta(meeting) && (
              <div className={styles.meetingMeta}>{meetingMeta(meeting)}</div>
            )}
            {(conflictsByMeetingIndex.get(meeting.meetingIndex) ?? []).map(
              (conflict, conflictIndex) => (
                <div key={conflictIndex} className={styles.meetingConflict}>
                  <ConflictTriangle size={11} />
                  Overlaps {conflict.other.courseCode}{' '}
                  {conflict.other.meetingType} ·{' '}
                  {describeConflictSlot(conflict)}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      {weekly.length === 0 && dated.length === 0 && (
        <div className={styles.noMeetings}>No meetings listed</div>
      )}
      {footer && <div className={styles.panelFooter}>{footer}</div>}
    </div>
  );
}

export default function WorksheetListItem({
  course,
  expanded,
  colorMenuOpen,
  colorPickerInSheet,
  conflicts,
  onToggleExpand,
  onColorMenuOpenChange,
}: {
  readonly course: WorksheetCourse;
  readonly expanded: boolean;
  readonly colorMenuOpen: boolean;
  readonly colorPickerInSheet: boolean;
  readonly conflicts: readonly CourseConflict[];
  readonly onToggleExpand: () => void;
  readonly onColorMenuOpenChange: (open: boolean) => void;
}) {
  const { listing, color } = course;
  const cardRef = useRef<HTMLDivElement>(null);
  const target = useCourseModalLink(listing);
  const setHoverCourse = useStore((state) => state.setHoverCourse);
  const isMobile = useStore((state) => state.isMobile);
  const theme = useStore((state) => state.theme);
  // Hover-highlighting the matching calendar blocks is a desktop affordance;
  // on touch devices a tap would leave the card focused and permanently dim
  // every other block, so the sync is disabled there.
  const syncHoverCourse = (value: Crn | null) => {
    if (!isMobile) setHoverCourse(value);
  };

  // Mobile only: dragging the card to the right reveals a Remove zone.
  const { remove: removeListing, canRemove } = useRemoveWorksheetListing(
    course.listing,
  );
  const swipeEnabled = isMobile && canRemove;
  const swipeGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: number;
    engaged: boolean;
  } | null>(null);
  const suppressNextClick = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);

  const clampSwipeOffset = (offset: number) => {
    const width = cardRef.current?.clientWidth ?? 0;
    return Math.min(Math.max(offset, 0), width);
  };

  const handleSwipePointerDown = (event: React.PointerEvent) => {
    if (!swipeEnabled || !event.isPrimary) return;
    swipeGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: swipeOffset,
      engaged: false,
    };
  };

  const handleSwipePointerMove = (event: React.PointerEvent) => {
    const gesture = swipeGesture.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.engaged) {
      // Lock in only on a clearly horizontal drag so vertical scrolling and
      // plain taps stay untouched.
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        gesture.engaged = true;
        setSwipeDragging(true);
        try {
          event.currentTarget.setPointerCapture(gesture.pointerId);
        } catch {
          // The pointer may already be gone (e.g. cancelled mid-gesture);
          // the drag still tracks via the bubbling move events.
        }
      } else if (Math.abs(dy) > 10) {
        swipeGesture.current = null;
        return;
      } else {
        return;
      }
    }
    setSwipeOffset(clampSwipeOffset(gesture.base + dx));
  };

  const handleSwipePointerEnd = (event: React.PointerEvent) => {
    const gesture = swipeGesture.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    swipeGesture.current = null;
    if (!gesture.engaged) return;
    setSwipeDragging(false);
    // The click that follows a drag must not toggle the card.
    suppressNextClick.current = true;
    setTimeout(() => {
      suppressNextClick.current = false;
    }, 0);
    const width = cardRef.current?.clientWidth ?? Infinity;
    const revealWidth = width * swipeRevealFraction;
    const offset = clampSwipeOffset(
      gesture.base + (event.clientX - gesture.startX),
    );
    if (event.type !== 'pointercancel' && offset >= width * 0.6) {
      setSwipeOffset(0);
      removeListing();
    } else if (event.type !== 'pointercancel' && offset >= revealWidth / 2) {
      setSwipeOffset(revealWidth);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleCardClickCapture = (event: React.MouseEvent) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // A tap anywhere on the card closes the revealed Remove zone.
    if (swipeOffset > 0) {
      setSwipeOffset(0);
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const primaryColor = useMemo(
    () => getWorksheetColorAppearance(color, theme).primary,
    [color, theme],
  );
  const meetings = useMemo(
    () => buildWorksheetItemMeetings(listing),
    [listing],
  );
  const { weekly } = meetings;
  const preview = weekly.find((meeting) => meeting.time !== 'TBA') ?? null;
  const { credits } = listing.course;
  const conflictingCourseCount = new Set(
    conflicts.map((conflict) => conflict.other.crn),
  ).size;

  const handleToggle = () => {
    const willExpand = !expanded;
    onToggleExpand();
    if (!willExpand) return;
    // After the panel renders, nudge the page so the newly revealed content
    // is visible, without pushing the card's top under the navbar.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const bottomMargin = 24;
        const navHeight = 64;
        if (rect.bottom <= window.innerHeight - bottomMargin) return;
        const overflow = rect.bottom - (window.innerHeight - bottomMargin);
        const maxDelta = Math.max(rect.top - navHeight, 0);
        const delta = Math.min(overflow, maxDelta);
        if (delta > 0) window.scrollBy({ top: delta, behavior: 'smooth' });
      });
    });
  };

  return (
    <div
      ref={cardRef}
      className={clsx(
        styles.swipeShell,
        swipeEnabled && styles.swipeShellTouch,
      )}
    >
      {swipeEnabled && (
        <div
          className={clsx(
            styles.swipeUnderlay,
            (swipeOffset > 0 || swipeDragging) && styles.swipeUnderlayVisible,
          )}
          aria-hidden={swipeOffset === 0}
        >
          <button
            type="button"
            className={styles.swipeRemoveButton}
            tabIndex={swipeOffset > 0 ? 0 : -1}
            onClick={removeListing}
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
            Remove
          </button>
        </div>
      )}
      <div
        className={clsx(styles.card, expanded && styles.cardExpanded)}
        style={
          swipeOffset > 0 || swipeDragging
            ? {
                transform: `translateX(${swipeOffset}px)`,
                transition: swipeDragging ? 'none' : undefined,
              }
            : undefined
        }
        onPointerDown={handleSwipePointerDown}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={handleSwipePointerEnd}
        onPointerCancel={handleSwipePointerEnd}
        onClickCapture={handleCardClickCapture}
        onMouseEnter={() => syncHoverCourse(listing.crn)}
        onMouseLeave={() => syncHoverCourse(null)}
        onFocus={() => syncHoverCourse(listing.crn)}
        onBlur={() => syncHoverCourse(null)}
      >
        {/* The chevron button is the keyboard-accessible expand control. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div className={styles.header} onClick={handleToggle}>
          <span
            className={styles.colorBar}
            style={{ backgroundColor: primaryColor }}
            aria-hidden="true"
          />
          <div className={styles.main}>
            <div className={styles.topRow}>
              <span className={styles.topLeft}>
                {/* Only the course code opens the modal; the section label and
                  the rest of the header toggle the expand panel. */}
                <Link
                  to={target}
                  className={styles.codeLink}
                  onClick={(event) => event.stopPropagation()}
                >
                  {listing.course_code}
                </Link>
                <span className={styles.sectionCode}>
                  {formatWorksheetSectionSuffix(listing)}
                </span>
                {conflicts.length > 0 && (
                  <span
                    className={styles.conflictPill}
                    title={conflicts.map(describeCourseConflict).join('; ')}
                  >
                    <ConflictTriangle size={10} />
                    {conflictingCourseCount === 1
                      ? 'Conflict'
                      : `${conflictingCourseCount} conflicts`}
                  </span>
                )}
              </span>
              <span className={styles.topRight}>
                {credits !== null && (
                  <span className={styles.credits}>
                    {credits} {credits === 1 ? 'credit' : 'credits'}
                  </span>
                )}
                <WorksheetColorMenuButton
                  course={course}
                  className={styles.colorButton}
                  iconSize={13}
                  externalPicker={colorPickerInSheet ? 'dialog' : undefined}
                  open={colorMenuOpen}
                  onOpenChange={onColorMenuOpenChange}
                />
                <button
                  type="button"
                  className={styles.chevronButton}
                  onClick={(event) => {
                    // Keep the header's own click handler from double-toggling
                    event.stopPropagation();
                    handleToggle();
                  }}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${listing.course_code}`}
                >
                  <FiChevronDown
                    className={clsx(
                      styles.chevron,
                      expanded && styles.chevronOpen,
                    )}
                    aria-hidden="true"
                  />
                </button>
              </span>
            </div>
            <div className={styles.title}>{listing.course.title}</div>
            {!expanded && (
              <div className={styles.preview}>
                {preview ? (
                  <>
                    <ListDayDots days={preview.days} />
                    <span className={styles.previewTime}>{preview.time}</span>
                    {preview.location && (
                      <>
                        <span
                          className={styles.previewSeparator}
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span className={styles.previewLocation}>
                          {preview.location}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className={styles.noSchedule}>
                    No lecture time scheduled
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <WorksheetMeetingDetails
            meetings={meetings}
            primaryColor={primaryColor}
            conflicts={conflicts}
            footer={
              <WorksheetViewModelRemoveButton
                listing={listing}
                className={styles.removeButton}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
