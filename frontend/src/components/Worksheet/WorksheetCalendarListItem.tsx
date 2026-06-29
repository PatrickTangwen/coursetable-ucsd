import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ListGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { BsExclamationTriangleFill } from 'react-icons/bs';
import { FiChevronDown } from 'react-icons/fi';
import { useShallow } from 'zustand/react/shallow';
import { useWorksheetCalendarListContext } from './WorksheetCalendarListContext';
import WorksheetHideButton from './WorksheetHideButton';
import WorksheetToggleButton from './WorksheetToggleButton';
import type { CatalogListing } from '../../queries/api';
import { useStore } from '../../store';
import {
  formatWorksheetSectionSuffix,
  toLocationsSummary,
} from '../../utilities/course';
import { useCourseModalLink } from '../../utilities/display';
import { ucsdMeetingTypeCode } from '../CourseModal/ucsdMeetingTypes';
import styles from './WorksheetCalendarListItem.module.css';

type WorksheetCalendarListItemProps = {
  readonly listing: CatalogListing;
  readonly hidden: boolean;
  readonly color: string;
};

type ExamMeeting = CatalogListing['course']['course_meetings'][number] & {
  date?: string | null;
  meeting_type?: string | null;
  raw_location?: string | null;
};

type ExamDetails = {
  kind: 'Midterm' | 'Final';
  date: string;
  time: string;
  location: string;
  daysUntil: number | null;
};

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatExamDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatExamTime(value: string | null | undefined) {
  if (!value) return '';
  const match = /^(?<hour>\d{1,2}):(?<minute>\d{2})/u.exec(value);
  if (!match?.groups) return value;
  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function examLocation(meeting: ExamMeeting) {
  if (meeting.location) {
    return `${meeting.location.building.code}${
      meeting.location.room ? ` ${meeting.location.room}` : ''
    }`;
  }
  return meeting.raw_location ?? '';
}

function daysUntilExam(value: string) {
  const date = parseLocalDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function countdownLabel(daysUntil: number | null) {
  if (daysUntil === null) return null;
  if (daysUntil < 0) return 'PAST';
  if (daysUntil === 0) return 'TODAY';
  if (daysUntil === 1) return 'TOMORROW';
  return `IN ${daysUntil} DAYS`;
}

function countdownClass(daysUntil: number | null) {
  if (daysUntil === null || daysUntil < 0) return styles.countdownPast;
  if (daysUntil <= 3) return styles.countdownSoon;
  if (daysUntil <= 10) return styles.countdownUpcoming;
  return styles.countdownLater;
}

function buildExamDetails(listing: CatalogListing): ExamDetails[] {
  return listing.course.course_meetings.flatMap((meeting) => {
    const examMeeting = meeting as ExamMeeting;
    const code = ucsdMeetingTypeCode(examMeeting.meeting_type);
    const kind =
      code === 'MI' ? 'Midterm' : code === 'FI' ? 'Final' : undefined;
    if (!kind || !examMeeting.date) return [];

    const start = formatExamTime(examMeeting.start_time);
    const end = formatExamTime(examMeeting.end_time);
    const time = [start, end].filter(Boolean).join(' – ');
    const location = examLocation(examMeeting);

    return [
      {
        kind,
        date: examMeeting.date,
        time,
        location,
        daysUntil: daysUntilExam(examMeeting.date),
      },
    ];
  });
}

export default function WorksheetCalendarListItem({
  listing,
  hidden,
  color,
}: WorksheetCalendarListItemProps) {
  const {
    showLocation,
    showMissingLocationIcon,
    highlightBuilding,
    missingBuildingCodes,
    hideTooltipContext,
  } = useWorksheetCalendarListContext();
  const target = useCourseModalLink(listing);
  const setHoverCourse = useStore((state) => state.setHoverCourse);
  const [expanded, setExpanded] = useState(false);
  const { viewedPerson, user } = useStore(
    useShallow((state) => ({
      viewedPerson: state.viewedPerson,
      user: state.user,
    })),
  );
  const locationSummary = toLocationsSummary(listing.course, user?.hasEvals);
  const locationDisplay =
    locationSummary === 'TBA' ? 'Location: TBA' : locationSummary;
  const missingCoordinate =
    showMissingLocationIcon &&
    listing.course.course_meetings.some((meeting) => {
      const code = meeting.location?.building.code;
      return Boolean(code && missingBuildingCodes.has(code));
    });
  const isHighlighted =
    Boolean(highlightBuilding) &&
    listing.course.course_meetings.some(
      (meeting) => meeting.location?.building.code === highlightBuilding,
    );
  const missingLocation =
    !locationSummary ||
    locationSummary.toUpperCase() === 'TBA' ||
    missingCoordinate;
  const examDetails = useMemo(() => buildExamDetails(listing), [listing]);

  return (
    <ListGroup.Item
      className={clsx(
        styles.listItem,
        expanded && styles.listItemExpanded,
        hidden && styles.listItemHidden,
        isHighlighted && styles.listItemHighlighted,
      )}
      onMouseEnter={() => setHoverCourse(listing.crn)}
      onMouseLeave={() => setHoverCourse(null)}
    >
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.headerToggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${listing.course_code}`}
        >
          <span
            className={styles.colorBar}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        </button>

        <Link
          to={target}
          className={clsx(styles.courseCode, hidden && styles.courseCodeHidden)}
        >
          <span className={styles.courseCodeLine}>
            <strong>{listing.course_code}</strong>
            <span className={styles.sectionCode}>
              {formatWorksheetSectionSuffix(listing)}
            </span>
          </span>
          <span className={styles.courseTitle}>{listing.course.title}</span>
          {showLocation && (
            <span className={styles.courseLocation}>
              {locationDisplay}
              {showMissingLocationIcon && missingLocation && (
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id={`location-warning-${listing.crn}`}>
                      {missingCoordinate
                        ? "We don't have map coordinates for this building yet."
                        : 'Location not yet available.'}
                    </Tooltip>
                  }
                >
                  <span className={styles.tbaIconWrapper}>
                    <BsExclamationTriangleFill
                      className={styles.tbaIcon}
                      size={13}
                    />
                  </span>
                </OverlayTrigger>
              )}
            </span>
          )}
        </Link>

        {viewedPerson === 'me' && (
          <WorksheetHideButton
            crn={listing.crn}
            hidden={hidden}
            className={clsx(
              styles.hideButton,
              !hidden && styles.hideButtonHidden,
            )}
            context={hideTooltipContext}
          />
        )}

        <button
          type="button"
          className={styles.chevronButton}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} exam details for ${listing.course_code}`}
        >
          <FiChevronDown className={styles.chevronIcon} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className={styles.examPanel}>
          {examDetails.length > 0 ? (
            examDetails.map((exam, index) => {
              const label = countdownLabel(exam.daysUntil);
              return (
                <div key={`${exam.kind}-${exam.date}`}>
                  {index > 0 && <div className={styles.examDivider} />}
                  <div className={styles.examRow}>
                    <span
                      className={clsx(
                        styles.examDot,
                        exam.kind === 'Midterm' && styles.examDotMuted,
                      )}
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <div className={styles.examText}>
                      <div className={styles.examTitleLine}>
                        <span className={styles.examKind}>{exam.kind}</span>
                        {label && (
                          <span
                            className={clsx(
                              styles.countdownBadge,
                              countdownClass(exam.daysUntil),
                            )}
                          >
                            {label}
                          </span>
                        )}
                      </div>
                      <div className={styles.examDate}>
                        {formatExamDate(exam.date)}
                      </div>
                      <div className={styles.examMeta}>
                        {[exam.time, exam.location].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.noExamDetails}>No exam meetings listed</div>
          )}

          <div className={styles.cardFooter}>
            <WorksheetToggleButton
              listing={listing}
              modal={false}
              inWorksheet
              appearance="remove"
            />
          </div>
        </div>
      )}
    </ListGroup.Item>
  );
}
