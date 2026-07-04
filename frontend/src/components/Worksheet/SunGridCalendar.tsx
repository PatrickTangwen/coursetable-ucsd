import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import chroma from 'chroma-js';
import { useShallow } from 'zustand/react/shallow';

import CalendarQuickModal from './CalendarQuickModal';
import { useToggleCourseHidden } from './WorksheetHideButton';
import { useStore } from '../../store';
import {
  getCalendarEvents,
  type CourseRBCEvent,
} from '../../utilities/calendar';
import {
  getScheduleConflicts,
  groupConflictsByCrn,
} from '../../utilities/scheduleConflicts';
import styles from './SunGridCalendar.module.css';

const baseWeekDays = [1, 2, 3, 4, 5];
const dayLabelByDay: { [day: number]: string } = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  0: 'Sun',
};

// Faint fractal-noise tile — gives the paper skin its matte grain when
// blended (soft-light) over the tinted fill.
const noiseTile = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type EventTag = {
  soft: string;
  solid: string;
  deep: string;
};

function safeChroma(color: string): chroma.Color {
  try {
    return chroma(color);
  } catch {
    return chroma('#378add');
  }
}

function tagFromColor(color: string): EventTag {
  const base = safeChroma(color);
  return {
    soft: chroma.mix(base, '#ffffff', 0.85).hex(),
    solid: base.hex(),
    deep: base.darken(2).hex(),
  };
}

type PositionedEvent = CourseRBCEvent & {
  colIndex: number;
  colCount: number;
};

/**
 * Assigns overlapping events of one day into side-by-side columns: events are
 * grouped into clusters of transitive overlap; within a cluster each event
 * takes the first column whose previous event has ended, and every event in
 * the cluster is as wide as 1/columns.
 */
function layoutDayEvents(events: CourseRBCEvent[]): PositionedEvent[] {
  const sorted = [...events].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      b.end.getTime() - a.end.getTime(),
  );

  const positioned: PositionedEvent[] = [];
  let cluster: { event: CourseRBCEvent; colIndex: number }[] = [];
  let clusterEnd = -Infinity;
  let columnEnds: number[] = [];

  const flushCluster = () => {
    for (const { event, colIndex } of cluster)
      positioned.push({ ...event, colIndex, colCount: columnEnds.length });

    cluster = [];
    columnEnds = [];
  };

  for (const event of sorted) {
    const startMs = event.start.getTime();
    if (cluster.length > 0 && startMs >= clusterEnd) flushCluster();

    let colIndex = columnEnds.findIndex((end) => end <= startMs);
    if (colIndex === -1) {
      colIndex = columnEnds.length;
      columnEnds.push(event.end.getTime());
    } else {
      columnEnds[colIndex] = event.end.getTime();
    }
    cluster.push({ event, colIndex });
    clusterEnd = Math.max(
      cluster.length === 1 ? -Infinity : clusterEnd,
      event.end.getTime(),
    );
  }
  flushCluster();
  return positioned;
}

function minutesOf(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatHourMinute(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? String(h) : `${h}:${String(minute).padStart(2, '0')}`;
}

export function formatTimeRange(start: Date, end: Date) {
  const startPeriod = start.getHours() < 12 ? 'AM' : 'PM';
  const endPeriod = end.getHours() < 12 ? 'AM' : 'PM';
  const startText = formatHourMinute(start.getHours(), start.getMinutes());
  const endText = formatHourMinute(end.getHours(), end.getMinutes());
  return startPeriod === endPeriod
    ? `${startText}–${endText} ${endPeriod}`
    : `${startText} ${startPeriod} – ${endText} ${endPeriod}`;
}

export function eventMeetingKey(event: CourseRBCEvent) {
  return `${event.meetingType}|${minutesOf(event.start)}|${minutesOf(event.end)}|${event.location}`;
}

function useElementHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateHeight = () => setHeight(element.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

function useNowMinutes(): { weekday: number; minutes: number } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return { weekday: now.getDay(), minutes: minutesOf(now) };
}

function eventSkin(
  tag: EventTag,
  gridStyle: 'paper' | 'embossed' | 'colorBar',
  hoverState: 'none' | 'hovered' | 'dimmed',
): CSSProperties {
  const skin: CSSProperties = { color: tag.deep };
  if (gridStyle === 'colorBar') {
    Object.assign(skin, {
      backgroundColor: tag.soft,
      border: `1px solid ${tag.solid}`,
      borderLeft: `3px solid ${tag.solid}`,
      borderRadius: 5,
      boxShadow: '0 1px 2px rgb(11 11 11 / 4%)',
    });
    if (hoverState === 'hovered')
      skin.boxShadow = '0 4px 12px rgb(11 11 11 / 8%)';
  } else if (gridStyle === 'embossed') {
    Object.assign(skin, {
      backgroundColor: tag.soft,
      backgroundImage: `linear-gradient(180deg, ${chroma.mix(tag.soft, '#ffffff', 0.42).hex()} 0%, ${tag.soft} 50%, ${chroma.mix(tag.soft, '#000000', 0.1).hex()} 100%)`,
      border: `1px solid ${chroma.mix(tag.solid, '#ffffff', 0.4).hex()}`,
      borderRadius: 6,
      boxShadow:
        'inset 0 1px 0 rgb(255 255 255 / 70%), inset 0 -1px 2px rgb(0 0 0 / 5%), 0 1px 2px rgb(11 11 11 / 8%), 0 2px 5px rgb(11 11 11 / 4%)',
    });
    if (hoverState === 'hovered') {
      skin.transform = 'translateY(-1px)';
      skin.boxShadow =
        'inset 0 1px 0 rgb(255 255 255 / 75%), 0 6px 16px rgb(11 11 11 / 14%), 0 2px 6px rgb(11 11 11 / 8%)';
    }
  } else {
    Object.assign(skin, {
      backgroundColor: tag.soft,
      backgroundImage: `${noiseTile}, linear-gradient(180deg, ${chroma.mix(tag.soft, '#ffffff', 0.28).hex()} 0%, ${tag.soft} 62%)`,
      backgroundSize: '140px 140px, auto',
      backgroundBlendMode: 'soft-light, normal',
      border: `1px solid ${chroma.mix(tag.solid, '#ffffff', 0.58).hex()}`,
      borderRadius: 6,
      boxShadow:
        'inset 0 1px 0 rgb(255 255 255 / 45%), 0 1px 1px rgb(42 34 25 / 5%), 0 3px 6px rgb(42 34 25 / 6%), 0 8px 14px rgb(42 34 25 / 4%)',
    });
    if (hoverState === 'hovered') {
      skin.transform = 'translateY(-1px)';
      skin.boxShadow =
        'inset 0 1px 0 rgb(255 255 255 / 50%), 0 4px 10px rgb(42 34 25 / 10%), 0 12px 22px rgb(42 34 25 / 8%)';
    }
  }
  if (hoverState === 'dimmed') skin.opacity = 0.32;
  if (hoverState === 'hovered') skin.zIndex = 3;
  return skin;
}

// One text size for every block — taller blocks don't get larger type, so
// side-by-side grids read as a single, uniform system.
function textScale(isMobile: boolean) {
  if (isMobile) return { titleSize: 11, metaSize: 10, lineHeight: 1.15 };
  return { titleSize: 12, metaSize: 11, lineHeight: 1.2 };
}

function EventBlock({
  event,
  rangeStartMin,
  totalRangeMin,
  bodyHeight,
  isMobile,
  onOpen,
}: {
  readonly event: PositionedEvent;
  readonly rangeStartMin: number;
  readonly totalRangeMin: number;
  readonly bodyHeight: number;
  readonly isMobile: boolean;
  readonly onOpen: (event: CourseRBCEvent) => void;
}) {
  const { hoverCourse, setHoverCourse, gridStyle } = useStore(
    useShallow((s) => ({
      hoverCourse: s.hoverCourse,
      setHoverCourse: s.setHoverCourse,
      gridStyle: s.calendarGridStyle,
    })),
  );
  const toggleCourseHidden = useToggleCourseHidden();
  const blockRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [fitFontPx, setFitFontPx] = useState<number | null>(null);

  const { crn } = event.listing;
  const startMin = minutesOf(event.start);
  const durationMin = Math.max(minutesOf(event.end) - startMin, 15);
  const topPct = ((startMin - rangeStartMin) / totalRangeMin) * 100;
  const heightPct = (durationMin / totalRangeMin) * 100;
  const widthPct = 100 / event.colCount;
  const leftPct = event.colIndex * widthPct;

  const tag = useMemo(() => tagFromColor(event.color), [event.color]);
  const hoverState =
    hoverCourse === null ? 'none' : hoverCourse === crn ? 'hovered' : 'dimmed';

  const realPx = (durationMin / totalRangeMin) * bodyHeight;
  const { titleSize, metaSize, lineHeight } = textScale(isMobile);
  const [padY, padX] = isMobile
    ? realPx < 34
      ? [1, 4]
      : [2, 4]
    : realPx < 58
      ? [2, 8]
      : realPx < 92
        ? [4, 8]
        : [7, 9];

  // Every field must be fully visible no matter the block's size, but the
  // font should stay as large as possible: lines wrap freely (the field
  // order — title, section, type, time, location — is what matters), so
  // tight blocks first trade line breaks for space, and only when even the
  // wrapped stack overflows the height does the font binary-search down to
  // the largest size that fits. The observer re-fits on block resizes
  // (column count / conflict splits / window) and content reflows (font
  // loading, text-size tier changes).
  useLayoutEffect(() => {
    const block = blockRef.current;
    const fit = fitRef.current;
    if (!block || !fit) return undefined;
    const update = () => {
      const availHeight = block.clientHeight - padY * 2;
      const fitsAt = (candidate: number) => {
        fit.style.fontSize = `${candidate}px`;
        return fit.scrollHeight <= availHeight;
      };
      let px = metaSize;
      if (!fitsAt(px)) {
        let lo = 4;
        let hi = metaSize;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          if (fitsAt(mid)) lo = mid;
          else hi = mid;
        }
        px = lo;
        fit.style.fontSize = `${px}px`;
      }
      setFitFontPx((prev) =>
        prev !== null && Math.abs(prev - px) < 0.1 ? prev : px,
      );
    };
    let disposed = false;
    update();
    // Text metrics change once the web font arrives; re-fit then, since the
    // reflow may leave the wrapped height (and thus the observer) unchanged.
    void document.fonts.ready.then(() => {
      if (!disposed) update();
    });
    const observer = new ResizeObserver(update);
    observer.observe(block);
    observer.observe(fit);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [metaSize, padY]);

  const timeText = isMobile ? '' : formatTimeRange(event.start, event.end);
  const showType = isMobile ? realPx >= 30 : true;
  const showTime = !isMobile && Boolean(timeText);
  const showLocation = !isMobile && Boolean(event.location);

  const geometry: CSSProperties = {
    top: `${topPct}%`,
    height: `${heightPct}%`,
    left: `calc(${leftPct}% + 3px)`,
    width: `calc(${widthPct}% - 6px)`,
  };

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- absolutely positioned grid block hosting a nested hide button
    <div
      ref={blockRef}
      className={styles.eventBlock}
      style={{ ...geometry, ...eventSkin(tag, gridStyle, hoverState) }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(event);
      }}
      onMouseEnter={() => setHoverCourse(crn)}
      onMouseLeave={() => setHoverCourse(null)}
      onFocus={() => setHoverCourse(crn)}
      onBlur={() => setHoverCourse(null)}
    >
      {/* Content always clusters at the top-left at the uniform text size;
          extra height in tall blocks stays empty rather than inflating type. */}
      <div
        className={styles.eventContent}
        style={{ padding: `${padY}px ${padX}px` }}
      >
        <div
          ref={fitRef}
          className={styles.eventFit}
          style={{
            rowGap: isMobile ? 0 : realPx >= 118 ? 2 : 1,
            fontSize: fitFontPx ?? metaSize,
          }}
        >
          <strong
            className={styles.eventLine}
            style={{
              fontWeight: 700,
              fontSize: `${titleSize / metaSize}em`,
              lineHeight,
            }}
          >
            {event.title.split(' ').slice(0, 2).join(' ')}
            {!isMobile && event.section && (
              <span className={styles.eventSection}> {event.section}</span>
            )}
          </strong>
          {showType && (
            <span
              className={styles.eventLine}
              style={{ fontWeight: 600, lineHeight }}
            >
              {event.meetingType}
            </span>
          )}
          {showTime && (
            <span
              className={styles.eventLine}
              style={{ fontWeight: 500, lineHeight, opacity: 0.9 }}
            >
              {timeText}
            </span>
          )}
          {showLocation && (
            <small
              className={styles.eventLine}
              style={{
                fontWeight: 400,
                fontSize: '1em',
                lineHeight,
                opacity: 0.72,
              }}
            >
              {event.location}
            </small>
          )}
        </div>
      </div>
      {toggleCourseHidden && (
        <div className={styles.eventButtons}>
          <button
            type="button"
            className={styles.eventHideButton}
            aria-label="Hide from calendar"
            onClick={(e) => {
              e.stopPropagation();
              void toggleCourseHidden(crn, false);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function SunGridCalendar() {
  const {
    courses,
    viewedSeason,
    isCalendarViewLocked,
    calendarLockStart,
    calendarLockEnd,
    calendarMode,
    isMobile,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      isCalendarViewLocked: state.isCalendarViewLocked,
      calendarLockStart: state.calendarLockStart,
      calendarLockEnd: state.calendarLockEnd,
      calendarMode: state.calendarMode,
      isMobile: state.isMobile,
    })),
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyHeight = useElementHeight(bodyRef);
  const now = useNowMinutes();
  const [openedEvent, setOpenedEvent] = useState<CourseRBCEvent | null>(null);

  const allEvents = useMemo(
    () => getCalendarEvents('rbc', courses, viewedSeason),
    [courses, viewedSeason],
  );

  // Conflicts among the courses actually shown on the grid (hidden ones are
  // excluded from rendering, so they don't count here either).
  const conflictsByCrn = useMemo(
    () =>
      groupConflictsByCrn(
        getScheduleConflicts(courses.filter((course) => !course.hidden)),
      ),
    [courses],
  );

  const modeEvents = useMemo(
    () =>
      allEvents.filter((event) =>
        calendarMode === 'finals'
          ? event.date !== null && event.meetingType === 'Final'
          : event.date === null,
      ),
    [allEvents, calendarMode],
  );

  const { startHour, endHour, events } = useMemo(() => {
    if (isCalendarViewLocked) {
      return {
        startHour: calendarLockStart,
        endHour: calendarLockEnd,
        events: modeEvents.filter((event) => {
          const endsBeforeStart =
            event.end.getHours() < calendarLockStart ||
            (event.end.getHours() === calendarLockStart &&
              event.end.getMinutes() === 0);
          const startsAfterEnd = event.start.getHours() >= calendarLockEnd;
          return !endsBeforeStart && !startsAfterEnd;
        }),
      };
    }
    if (modeEvents.length === 0)
      return { startHour: 8, endHour: 18, events: modeEvents };
    let earliest = 8;
    let latest = 8 * 60 + 60;
    for (const event of modeEvents) {
      earliest = Math.min(earliest, event.start.getHours());
      latest = Math.max(latest, minutesOf(event.end));
    }
    return {
      startHour: earliest,
      endHour: Math.ceil(latest / 60) + 1,
      events: modeEvents,
    };
  }, [modeEvents, isCalendarViewLocked, calendarLockStart, calendarLockEnd]);

  const rangeStartMin = startHour * 60;
  const totalRangeMin = (endHour - startHour) * 60;

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = startHour; h < endHour; h++) {
      const display = h <= 12 ? h : h - 12;
      const period = h < 12 ? 'am' : 'pm';
      slots.push({
        hour: String(display === 0 ? 12 : display),
        period: isMobile ? period[0]! : period,
      });
    }
    return slots;
  }, [startHour, endHour, isMobile]);

  // Finals week can include Saturday/Sunday exam blocks — only add those
  // columns when a final actually lands there, so the regular Mon–Fri grid
  // (and finals weeks with no weekend exams) stay unchanged.
  const visibleDays = useMemo(() => {
    const days = [...baseWeekDays];
    if (calendarMode === 'finals') {
      if (events.some((event) => event.day === 6)) days.push(6);
      if (events.some((event) => event.day === 0)) days.push(0);
    }
    return days;
  }, [events, calendarMode]);

  const eventsByDay = useMemo(() => {
    const byDay = new Map<number, CourseRBCEvent[]>();
    for (const event of events) {
      const { day } = event;
      if (!visibleDays.includes(day)) continue;
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }
    return visibleDays.map((day) => layoutDayEvents(byDay.get(day) ?? []));
  }, [events, visibleDays]);

  const showNowLine =
    calendarMode === 'week' &&
    now.weekday >= 1 &&
    now.weekday <= 5 &&
    now.minutes >= rangeStartMin &&
    now.minutes <= rangeStartMin + totalRangeMin;
  const nowTopPct = ((now.minutes - rangeStartMin) / totalRangeMin) * 100;

  const gutterWidth = isMobile ? 40 : 54;
  const gridColumns = {
    '--cal-gutter': `${gutterWidth}px`,
    '--cal-day-cols': visibleDays.length,
  } as CSSProperties;

  return (
    <div className={styles.calendar} style={gridColumns}>
      <div className={styles.headerRow}>
        <div className={styles.headerGutter} />
        {visibleDays.map((day) => (
          <div key={day} className={styles.headerDay}>
            {dayLabelByDay[day]}
          </div>
        ))}
      </div>
      <div ref={bodyRef} className={styles.body}>
        <div className={styles.innerGrid}>
          <div className={styles.timeGutter}>
            {timeSlots.map((slot, i) => (
              <div key={i} className={styles.timeSlot}>
                <span className={styles.timeLabel}>
                  <span className={styles.timeHour}>{slot.hour}</span>
                  <span className={styles.timePeriod}>{slot.period}</span>
                </span>
                <span className={styles.timeTick} />
              </div>
            ))}
          </div>
          {visibleDays.map((day, dayIndex) => (
            <div
              key={day}
              className={styles.dayColumn}
              data-last={dayIndex === visibleDays.length - 1 || undefined}
            >
              {timeSlots.map((_, i) => (
                <div key={i} className={styles.hourCell} />
              ))}
              {eventsByDay[dayIndex]!.map((event, i) => (
                <EventBlock
                  key={`${event.listing.crn}-${event.start.getTime()}-${i}`}
                  event={event}
                  rangeStartMin={rangeStartMin}
                  totalRangeMin={totalRangeMin}
                  bodyHeight={bodyHeight}
                  isMobile={isMobile}
                  onOpen={setOpenedEvent}
                />
              ))}
            </div>
          ))}
          {showNowLine && (
            <div className={styles.nowLine} style={{ top: `${nowTopPct}%` }}>
              <span className={styles.nowDot} />
            </div>
          )}
        </div>
      </div>
      {openedEvent && (
        <CalendarQuickModal
          listing={openedEvent.listing}
          color={openedEvent.color}
          viewingKey={eventMeetingKey(openedEvent)}
          conflicts={conflictsByCrn.get(openedEvent.listing.crn) ?? []}
          onClose={() => setOpenedEvent(null)}
        />
      )}
    </div>
  );
}
