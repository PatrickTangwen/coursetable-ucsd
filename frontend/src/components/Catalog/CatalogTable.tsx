import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import DayDots from './DayDots';
import SeatsDisplay from './SeatsDisplay';
import type { CatalogListing } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import type { CatalogSortKey } from '../../slices/CatalogViewSlice';
import { useStore } from '../../store';
import {
  parseDays,
  formatTime,
  buildOfferingGroups,
  type OfferingGroup,
} from '../../utilities/catalogView';
import { toSeasonString } from '../../utilities/course';
import WorksheetToggleButton from '../Worksheet/WorksheetToggleButton';
import styles from './CatalogTable.module.css';

type CourseRow = {
  rowId: string;
  sameCourseId: number;
  courseCode: string;
  seasonCode: Season;
  title: string;
  groups: OfferingGroup[];
  totalSections: number;
  listings: CatalogListing[];
};

const baseRowHeight = 45;
const subRowHeight = 37;
const expandedScrollHeight = 132;
const scrollHintHeight = 24;
const overscanRows = 8;
const minCourseCodeWidthCh = 9;
const courseCodeWidthBufferCh = 2;
const horizontalVisibilityTolerance = 1;

const courseCodeCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function groupListingsByCourse(listings: CatalogListing[]): CourseRow[] {
  const map = new Map<string, CatalogListing[]>();
  for (const l of listings) {
    const key = `${l.course.season_code}:${l.course.same_course_id}`;
    const list = map.get(key);
    if (list) list.push(l);
    else map.set(key, [l]);
  }

  const rows: CourseRow[] = [];
  for (const [rowId, group] of map) {
    const first = group[0]!;
    const sameCourseId = first.course.same_course_id;
    const sections = group.map((l) => {
      const cal = (l.course as { [key: string]: unknown }).ucsd_calendar as
        | { [key: string]: unknown }
        | undefined;
      return {
        section_id: String(
          (cal?.section_id as string | number | undefined) ?? l.crn,
        ),
        course_id: String(sameCourseId),
        section_code: (cal?.section_code ?? l.course.section) as string | null,
        meeting_type: (cal?.meeting_type ?? null) as string | null,
        instructors: l.course.course_professors.map((p) => p.professor.name),
        meetings: Array.isArray(cal?.meetings)
          ? (cal.meetings as { [key: string]: unknown }[]).map((m) => ({
              days: (m.days ?? []) as string[],
              start_time: (m.start_time ?? null) as string | null,
              end_time: (m.end_time ?? null) as string | null,
              building: (m.building ?? null) as string | null,
              room: (m.room ?? null) as string | null,
              is_tba: Boolean(m.is_tba),
              meeting_type: (m.meeting_type ?? null) as string | null,
              raw_days: (m.raw_days ?? null) as string | null,
              raw_time: (m.raw_time ?? null) as string | null,
              raw_location: (m.raw_location ?? null) as string | null,
            }))
          : l.course.course_meetings.map((m) => ({
              days: [] as string[],
              start_time: m.start_time,
              end_time: m.end_time,
              building: m.location?.building.code ?? null,
              room: m.location?.room ?? null,
              is_tba: false,
              meeting_type: (m as { [key: string]: unknown }).meeting_type as
                | string
                | null,
              raw_days: null as string | null,
              raw_time: null as string | null,
              raw_location: null as string | null,
            })),
        enrolled: (cal?.enrolled ?? null) as number | null,
        capacity: (cal?.capacity ?? null) as number | null,
        waitlist_count: 0,
        raw: {},
        listing: l,
      };
    });

    const groups = buildOfferingGroups(sections);
    rows.push({
      rowId,
      sameCourseId,
      courseCode: first.course_code,
      seasonCode: first.course.season_code,
      title: first.course.title,
      groups,
      totalSections: group.length,
      listings: group,
    });
  }
  return rows;
}

function getFirstMeetingTime(row: CourseRow): number {
  for (const g of row.groups) {
    if (g.sharedMeetings.length > 0) {
      const m = g.sharedMeetings[0]!;
      if (m.start_time) {
        const [h, min] = m.start_time.split(':').map(Number);
        return (h ?? 0) * 60 + (min ?? 0);
      }
    }
    if (g.sections.length > 0) {
      const sec = g.sections[0]!;
      for (const m of sec.meetings) {
        if (m.start_time) {
          const [h, min] = m.start_time.split(':').map(Number);
          return (h ?? 0) * 60 + (min ?? 0);
        }
      }
    }
  }
  return Infinity;
}

function getTermSortValue(seasonCode: Season): number {
  const match = /^(?<term>WI|SP|S1|S2|S3|SU|FA)(?<year>\d{2})$/u.exec(
    seasonCode,
  );
  const term = match?.groups?.term;
  const year = match?.groups?.year;
  if (!term || !year) return Number.MAX_SAFE_INTEGER;

  const termOrder: { [term: string]: number } = {
    WI: 0,
    SP: 1,
    S1: 2,
    SU: 2,
    S2: 3,
    S3: 4,
    FA: 5,
  };
  return Number(`20${year}`) * 10 + (termOrder[term] ?? 9);
}

function sortRows(rows: CourseRow[], key: CatalogSortKey, asc: boolean) {
  const sorted = [...rows];
  const dir = asc ? 1 : -1;
  sorted.sort((a, b) => {
    switch (key) {
      case 'code':
        return dir * courseCodeCollator.compare(a.courseCode, b.courseCode);
      case 'title':
        return dir * a.title.localeCompare(b.title);
      case 'term':
        return (
          dir *
          (getTermSortValue(a.seasonCode) - getTermSortValue(b.seasonCode) ||
            a.courseCode.localeCompare(b.courseCode) ||
            a.title.localeCompare(b.title))
        );
      case 'meets':
        return dir * (getFirstMeetingTime(a) - getFirstMeetingTime(b));
      default:
        return 0;
    }
  });
  return sorted;
}

function courseCodeColumnStyle(rows: CourseRow[]): CSSProperties {
  const longestCourseCode = rows.reduce(
    (max, row) => Math.max(max, row.courseCode.length),
    minCourseCodeWidthCh,
  );
  return {
    '--catalog-course-code-slot': `${
      longestCourseCode + courseCodeWidthBufferCh
    }ch`,
  } as CSSProperties;
}

function expandedRowHeight(row: CourseRow): number {
  const visibleSubRows =
    row.totalSections > 3
      ? expandedScrollHeight
      : row.totalSections * subRowHeight;
  return (
    baseRowHeight +
    visibleSubRows +
    (row.totalSections > 3 ? scrollHintHeight : 0)
  );
}

function courseRowHeight(row: CourseRow, expandedCourses: Set<string>): number {
  if (row.totalSections <= 1) return baseRowHeight;
  return expandedCourses.has(row.rowId)
    ? expandedRowHeight(row)
    : baseRowHeight;
}

function prefixOffsets(heights: number[]): number[] {
  const offsets = [0];
  for (const height of heights)
    offsets.push(offsets[offsets.length - 1]! + height);
  return offsets;
}

function firstVisibleIndex(offsets: number[], scrollTop: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid + 1]! <= scrollTop) low = mid + 1;
    else high = mid;
  }
  return low;
}

function lastVisibleIndex(offsets: number[], viewportBottom: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (offsets[mid]! < viewportBottom) low = mid;
    else high = mid - 1;
  }
  return Math.max(0, low);
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

function shouldShowHorizontalScrollbar(
  wrapper: HTMLElement,
  seatHeader: HTMLElement,
): boolean {
  if (
    wrapper.scrollWidth - wrapper.clientWidth <=
    horizontalVisibilityTolerance
  )
    return false;

  const wrapperRect = wrapper.getBoundingClientRect();
  const seatHeaderRect = seatHeader.getBoundingClientRect();
  const wrapperVisible =
    wrapperRect.bottom > 0 && wrapperRect.top < window.innerHeight;
  const isScrolledHorizontally =
    wrapper.scrollLeft > horizontalVisibilityTolerance;

  return (
    wrapperVisible &&
    (isScrolledHorizontally ||
      seatHeaderRect.right <=
        wrapperRect.left + horizontalVisibilityTolerance ||
      seatHeaderRect.left >= wrapperRect.right - horizontalVisibilityTolerance)
  );
}

function visibleHorizontalFrame(wrapper: HTMLElement) {
  const wrapperRect = wrapper.getBoundingClientRect();
  const left = Math.max(0, wrapperRect.left);
  const right = Math.min(window.innerWidth, wrapperRect.right);
  return {
    left,
    width: Math.max(0, right - left),
  };
}

function SortHeader({
  label,
  sortKey,
  className,
}: {
  readonly label: string;
  readonly sortKey: CatalogSortKey;
  readonly className?: string;
}) {
  const { currentKey, asc, setSort } = useStore(
    useShallow((s) => ({
      currentKey: s.catalogSortKey,
      asc: s.catalogSortAsc,
      setSort: s.setCatalogSort,
    })),
  );
  const active = currentKey === sortKey;
  const sortDirection = active && !asc ? '▲' : '▼';
  return (
    <div className={clsx(styles.headerCell, className)}>
      <span>{label}</span>
      <button
        type="button"
        className={styles.sortIndicator}
        onClick={() => setSort(sortKey)}
        aria-label={`Sort by ${label}`}
        aria-pressed={active}
      >
        {sortDirection}
      </button>
    </div>
  );
}

function ChevronIcon({ open }: { readonly open: boolean }) {
  return (
    <svg
      className={clsx(styles.chevron, open && styles.chevronOpen)}
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 2.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MeetingDisplay({
  meetings,
}: {
  readonly meetings: {
    raw_days: string | null;
    start_time: string | null;
    end_time: string | null;
    is_tba: boolean;
  }[];
}) {
  const [first] = meetings;
  if (!first || first.is_tba)
    return <span className={styles.meetTime}>TBA</span>;

  const days = parseDays(first.raw_days ?? '');
  const time = formatTime(first.start_time, first.end_time);
  return (
    <>
      <DayDots days={days} />
      <span className={styles.meetTime}>{time}</span>
    </>
  );
}

function LocationDisplay({
  meetings,
}: {
  readonly meetings: {
    building: string | null;
    room: string | null;
    is_tba: boolean;
  }[];
}) {
  const [first] = meetings;
  if (!first || first.is_tba) return <span>TBA</span>;
  const parts = [first.building, first.room].filter(Boolean);
  return <span>{parts.join(' ') || 'TBA'}</span>;
}

function TermBadge({ seasonCode }: { readonly seasonCode: Season }) {
  const family = seasonCode.slice(0, 2).toUpperCase();
  const familyClass =
    family === 'FA'
      ? styles.termBadgeFall
      : family === 'WI'
        ? styles.termBadgeWinter
        : family === 'SP'
          ? styles.termBadgeSpring
          : family.startsWith('S')
            ? styles.termBadgeSummer
            : undefined;

  return (
    <span
      className={clsx(styles.termBadge, familyClass)}
      title={toSeasonString(seasonCode)}
    >
      {seasonCode}
    </span>
  );
}

function CourseTitle({ title }: { readonly title: string }) {
  return (
    <span className={styles.titleContent}>
      <span className={styles.titleText}>{title}</span>
    </span>
  );
}

function FlatRow({
  row,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CatalogListing) => void;
}) {
  const group = row.groups[0]!;
  const firstSection = group.sections[0]!;
  const instructor = firstSection.instructors[0] ?? 'Staff';
  const meetings =
    group.sharedMeetings.length > 0
      ? group.sharedMeetings
      : firstSection.meetings;
  const listing = row.listings[0]!;
  const isSingle = row.totalSections === 1;

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS flex grid row, not a real table
    <div
      className={styles.row}
      onClick={() => onOpenModal(listing)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenModal(listing);
      }}
    >
      <div className={styles.addCell}>
        {isSingle && <WorksheetToggleButton listing={listing} modal={false} />}
      </div>
      <div className={clsx(styles.cell, styles.codeCell)}>
        <span className={styles.courseCode}>{row.courseCode}</span>
        {isSingle && firstSection.section_code && (
          <span className={clsx(styles.sectionSlot, styles.sectionId)}>
            {firstSection.section_code}
          </span>
        )}
        {!isSingle && (
          <span className={styles.sectionSlot}>
            <span className={styles.sectionBadge}>
              {row.totalSections} sections
            </span>
          </span>
        )}
      </div>
      <div className={clsx(styles.cell, styles.titleCell)}>
        <CourseTitle title={row.title} />
      </div>
      {showTermColumn && (
        <div className={clsx(styles.cell, styles.termCell)}>
          <TermBadge seasonCode={row.seasonCode} />
        </div>
      )}
      <div className={clsx(styles.cell, styles.instructorCell)}>
        {instructor}
      </div>
      <div className={clsx(styles.cell, styles.meetsCell)}>
        <MeetingDisplay meetings={meetings} />
      </div>
      <div className={clsx(styles.cell, styles.locationCell)}>
        <LocationDisplay meetings={meetings} />
      </div>
      <div className={clsx(styles.cell, styles.seatsCell)}>
        <SeatsDisplay
          enrolled={group.totalEnrolled}
          capacity={group.totalCapacity}
        />
      </div>
    </div>
  );
}

function ExpandableRow({
  row,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CatalogListing) => void;
}) {
  const { expanded, toggle } = useStore(
    useShallow((s) => ({
      expanded: s.catalogExpandedCourses.has(row.rowId),
      toggle: s.toggleCatalogExpanded,
    })),
  );

  const listing = row.listings[0]!;
  const toggleExpanded = () => toggle(row.rowId);
  const openModal = () => onOpenModal(listing);

  const parentRow = (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS flex grid row, not a real table
    <div
      className={clsx(
        styles.row,
        styles.parentRow,
        expanded && styles.expandedParent,
      )}
      role="row"
    >
      <div className={styles.addCell} />
      <button
        type="button"
        className={clsx(
          styles.cellButton,
          styles.cell,
          styles.codeCell,
          styles.toggleCell,
        )}
        aria-expanded={expanded}
        aria-label={`${row.courseCode} ${row.totalSections} sections`}
        onClick={toggleExpanded}
      >
        <span className={styles.courseCode}>{row.courseCode}</span>
        <span className={styles.sectionSlot}>
          <span className={styles.sectionBadge}>
            {row.totalSections} sections
            <ChevronIcon open={expanded} />
          </span>
        </span>
      </button>
      <button
        type="button"
        className={clsx(
          styles.cellButton,
          styles.cell,
          styles.titleCell,
          styles.modalTitleCell,
        )}
        onClick={openModal}
      >
        <CourseTitle title={row.title} />
      </button>
      {showTermColumn && (
        <div className={clsx(styles.cell, styles.termCell)}>
          <TermBadge seasonCode={row.seasonCode} />
        </div>
      )}
      <div
        className={clsx(styles.cell, styles.instructorCell, styles.summaryText)}
      >
        {
          new Set(
            row.groups.flatMap((g) => g.sections.flatMap((s) => s.instructors)),
          ).size
        }{' '}
        instructors
      </div>
      <div className={clsx(styles.cell, styles.meetsCell, styles.summaryText)}>
        Multiple schedules
      </div>
      <div
        className={clsx(styles.cell, styles.locationCell, styles.summaryText)}
      >
        {row.groups.length} locations
      </div>
      <div className={clsx(styles.cell, styles.seatsCell)} />
    </div>
  );

  if (!expanded) return parentRow;

  return (
    <div className={styles.expandableGroup}>
      {parentRow}
      <div
        className={clsx(
          styles.subRowContainer,
          row.totalSections > 3 && styles.subRowContainerWithScroll,
        )}
      >
        {row.groups.flatMap((group) =>
          group.sections.map((sec) => {
            const { meetings } = sec;
            const groupListing =
              row.listings.find(
                (l) =>
                  (l.course as { [key: string]: unknown }).ucsd_calendar &&
                  (
                    (l.course as { [key: string]: unknown }).ucsd_calendar as {
                      [key: string]: unknown;
                    }
                  ).section_id === sec.section_id,
              ) ?? listing;

            return (
              // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS flex grid row, not a real table
              <div
                key={sec.section_id}
                className={styles.subRow}
                onClick={() => onOpenModal(groupListing)}
                role="row"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    onOpenModal(groupListing);
                }}
              >
                <div className={styles.addCell}>
                  <WorksheetToggleButton listing={groupListing} modal={false} />
                </div>
                <div className={clsx(styles.cell, styles.codeCell)}>
                  <span className={styles.subSectionBadge}>
                    {sec.section_code ?? group.familyPrefix}
                  </span>
                </div>
                <div
                  className={clsx(
                    styles.cell,
                    styles.titleCell,
                    styles.subTitleCell,
                  )}
                >
                  {sec.meeting_type && (
                    <span className={styles.typeBadge}>
                      {sec.meeting_type.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <SeatsDisplay
                    enrolled={sec.enrolled}
                    capacity={sec.capacity}
                    variant="subrow"
                  />
                </div>
                {showTermColumn && (
                  <div className={clsx(styles.cell, styles.termCell)} />
                )}
                <div className={clsx(styles.cell, styles.instructorCell)}>
                  {sec.instructors[0] ?? 'Staff'}
                </div>
                <div className={clsx(styles.cell, styles.meetsCell)}>
                  <MeetingDisplay meetings={meetings} />
                </div>
                <div className={clsx(styles.cell, styles.locationCell)}>
                  <LocationDisplay meetings={meetings} />
                </div>
                <div className={clsx(styles.cell, styles.seatsCell)} />
              </div>
            );
          }),
        )}
        {row.totalSections > 3 && (
          <div className={styles.scrollHint}>↓ scroll for more sections</div>
        )}
      </div>
    </div>
  );
}

export default function CatalogTable({
  data,
  onOpenModal,
}: {
  readonly data: CatalogListing[] | null;
  readonly onOpenModal: (listing: CatalogListing) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const seatHeaderRef = useRef<HTMLDivElement>(null);
  const horizontalScrollbarRef = useRef<HTMLDivElement>(null);
  const wrapperHeight = useElementHeight(wrapperRef);
  const headerHeight = useElementHeight(headerRef);
  const [scrollTop, setScrollTop] = useState(0);
  const [showHorizontalScrollbar, setShowHorizontalScrollbar] = useState(false);
  const [horizontalScrollWidth, setHorizontalScrollWidth] = useState(0);
  const [horizontalScrollbarFrame, setHorizontalScrollbarFrame] = useState({
    left: 0,
    width: 0,
  });

  const { sortKey, sortAsc, expandedCourses } = useStore(
    useShallow((s) => ({
      sortKey: s.catalogSortKey,
      sortAsc: s.catalogSortAsc,
      expandedCourses: s.catalogExpandedCourses,
    })),
  );

  const courseRows = useMemo(() => {
    if (!data) return [];
    return sortRows(groupListingsByCourse(data), sortKey, sortAsc);
  }, [data, sortKey, sortAsc]);
  const codeColumnStyle = useMemo(
    () => courseCodeColumnStyle(courseRows),
    [courseRows],
  );
  const showTermColumn = useMemo(
    () => new Set(courseRows.map((row) => row.seasonCode)).size > 1,
    [courseRows],
  );
  const rowHeights = useMemo(
    () => courseRows.map((row) => courseRowHeight(row, expandedCourses)),
    [courseRows, expandedCourses],
  );
  const rowOffsets = useMemo(() => prefixOffsets(rowHeights), [rowHeights]);
  const totalRowsHeight = rowOffsets[rowOffsets.length - 1] ?? 0;
  const rowScrollTop = Math.max(0, scrollTop - headerHeight);
  const viewportHeight = Math.max(0, wrapperHeight - headerHeight);
  const visibleStart = courseRows.length
    ? Math.max(0, firstVisibleIndex(rowOffsets, rowScrollTop) - overscanRows)
    : 0;
  const visibleEnd = courseRows.length
    ? Math.min(
        courseRows.length - 1,
        lastVisibleIndex(rowOffsets, rowScrollTop + viewportHeight) +
          overscanRows,
      )
    : -1;
  const visibleRows =
    visibleEnd >= visibleStart
      ? courseRows.slice(visibleStart, visibleEnd + 1)
      : [];
  const topSpacerHeight = rowOffsets[visibleStart] ?? 0;
  const bottomSpacerHeight =
    totalRowsHeight - (rowOffsets[visibleEnd + 1] ?? topSpacerHeight);

  const updateHorizontalScrollbarVisibility = useCallback(() => {
    const wrapper = wrapperRef.current;
    const seatHeader = seatHeaderRef.current;
    if (!wrapper || !seatHeader) {
      setShowHorizontalScrollbar(false);
      setHorizontalScrollWidth(0);
      return;
    }

    setHorizontalScrollWidth(wrapper.scrollWidth);
    setHorizontalScrollbarFrame(visibleHorizontalFrame(wrapper));
    setShowHorizontalScrollbar(
      shouldShowHorizontalScrollbar(wrapper, seatHeader),
    );

    const horizontalScrollbar = horizontalScrollbarRef.current;
    if (
      horizontalScrollbar &&
      Math.abs(horizontalScrollbar.scrollLeft - wrapper.scrollLeft) >
        horizontalVisibilityTolerance
    )
      horizontalScrollbar.scrollLeft = wrapper.scrollLeft;
  }, []);

  useEffect(() => {
    updateHorizontalScrollbarVisibility();

    const wrapper = wrapperRef.current;
    const seatHeader = seatHeaderRef.current;
    if (!wrapper || !seatHeader) return undefined;

    const resizeObserver = new ResizeObserver(
      updateHorizontalScrollbarVisibility,
    );
    resizeObserver.observe(wrapper);
    resizeObserver.observe(seatHeader);

    return () => resizeObserver.disconnect();
  }, [
    codeColumnStyle,
    showTermColumn,
    totalRowsHeight,
    updateHorizontalScrollbarVisibility,
  ]);

  const renderRow = useCallback(
    (row: CourseRow) => {
      if (row.totalSections > 1) {
        return (
          <ExpandableRow
            key={row.rowId}
            row={row}
            showTermColumn={showTermColumn}
            onOpenModal={onOpenModal}
          />
        );
      }
      return (
        <FlatRow
          key={row.rowId}
          row={row}
          showTermColumn={showTermColumn}
          onOpenModal={onOpenModal}
        />
      );
    },
    [onOpenModal, showTermColumn],
  );

  return (
    <div
      ref={wrapperRef}
      className={styles.tableWrapper}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
        updateHorizontalScrollbarVisibility();
      }}
    >
      <div
        style={codeColumnStyle}
        className={clsx(
          styles.tableInner,
          showTermColumn && styles.tableInnerWithTerm,
        )}
      >
        <div ref={headerRef} className={styles.header}>
          <div className={clsx(styles.headerCell, styles.colAdd)} />
          <SortHeader label="Code" sortKey="code" className={styles.colCode} />
          <SortHeader
            label="Title"
            sortKey="title"
            className={styles.colTitle}
          />
          {showTermColumn && (
            <SortHeader
              label="Term"
              sortKey="term"
              className={styles.colTerm}
            />
          )}
          <div className={clsx(styles.headerCell, styles.colInstructor)}>
            Instructors
          </div>
          <SortHeader
            label="Meets"
            sortKey="meets"
            className={styles.colMeets}
          />
          <div className={clsx(styles.headerCell, styles.colLocation)}>
            Location
          </div>
          <div
            ref={seatHeaderRef}
            className={clsx(styles.headerCell, styles.colSeats)}
          >
            Seats
          </div>
        </div>

        {courseRows.length === 0 ? (
          <div className={styles.empty}>No courses match your filters.</div>
        ) : (
          <div
            className={styles.virtualRows}
            style={{ minHeight: totalRowsHeight }}
          >
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
            {visibleRows.map(renderRow)}
            {bottomSpacerHeight > 0 && (
              <div style={{ height: bottomSpacerHeight }} />
            )}
          </div>
        )}
      </div>
      <div
        ref={horizontalScrollbarRef}
        aria-hidden={!showHorizontalScrollbar}
        className={clsx(
          styles.horizontalScrollbar,
          !showHorizontalScrollbar && styles.horizontalScrollbarHidden,
        )}
        style={horizontalScrollbarFrame}
        onScroll={(event) => {
          const wrapper = wrapperRef.current;
          if (!wrapper) return;
          if (
            Math.abs(wrapper.scrollLeft - event.currentTarget.scrollLeft) >
            horizontalVisibilityTolerance
          )
            wrapper.scrollLeft = event.currentTarget.scrollLeft;

          updateHorizontalScrollbarVisibility();
        }}
      >
        <div
          className={styles.horizontalScrollbarSpacer}
          style={{ width: horizontalScrollWidth }}
        />
      </div>
    </div>
  );
}
