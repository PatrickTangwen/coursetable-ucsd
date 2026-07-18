import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import DayDots from './DayDots';
import SeatsDisplay from './SeatsDisplay';
import { requireLegacyCatalogListing } from '../../ferry/ferryCatalogCache';
import { isLegacyUserInfo } from '../../queries/api';
import type { CoursePlanningListing } from '../../queries/coursePlanningViewModels';
import type { Season } from '../../queries/graphql-types';
import type { CatalogSortKey } from '../../slices/CatalogViewSlice';
import { useStore } from '../../store';
import { anonymousWorksheetHasListing } from '../../utilities/anonymousWorksheet';
import {
  parseDays,
  formatTime,
  buildOfferingGroups,
  type OfferingGroup,
} from '../../utilities/catalogView';
import { isInWorksheet, toSeasonString } from '../../utilities/course';
import { savedWorksheetHasListing } from '../../utilities/savedWorksheet';
import CoursePlanningWorksheetToggleButton from '../Worksheet/CoursePlanningWorksheetToggleButton';
import LegacyWorksheetToggleButton from '../Worksheet/LegacyWorksheetToggleButton';
import styles from './CatalogTable.module.css';

type CourseRow = {
  rowId: string;
  sameCourseId: string;
  courseCode: string;
  seasonCode: Season;
  title: string;
  groups: OfferingGroup[];
  totalSections: number;
  listings: CoursePlanningListing[];
};

type OfferingSection = OfferingGroup['sections'][number];

type ViewMode = 'full' | 'compact' | 'mobile';

// Breakpoints must stay in sync with the CSS media queries in
// CatalogListView.module.css / TopNav.module.css. 1320px matches the
// app-wide compact media queries (and upstream CourseTable's breakpoint).
const mobileBreakpoint = 900;
const compactBreakpoint = 1320;

// Heights must stay in sync with the CSS row heights.
const baseRowHeight = 55;
const subRowHeight = 42;
const subRowsMaxHeight = 190;
const overscanRows = 8;
const minCourseCodeWidthCh = 9;
const courseCodeWidthBufferCh = 2;
const sectionCountWidthBufferCh = 9;

const courseCodeCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function groupListingsByCourse(listings: CoursePlanningListing[]): CourseRow[] {
  const map = new Map<string, CoursePlanningListing[]>();
  for (const l of listings) {
    const key = `${l.section.supportedTerm}:${l.course.courseId}`;
    const list = map.get(key);
    if (list) list.push(l);
    else map.set(key, [l]);
  }

  const rows: CourseRow[] = [];
  for (const [rowId, group] of map) {
    const first = group[0]!;
    const sameCourseId = first.course.courseId;
    const sections = group.map((l) => {
      const { section } = l;
      return {
        section_id: section.sectionId,
        course_id: section.courseId,
        section_code: section.sectionCode,
        meeting_type: section.meetingType,
        instructors: section.instructors.map(({ name }) => name),
        meetings: section.meetings.map((meeting) => ({
          days: meeting.days,
          date: meeting.date,
          start_time: meeting.startTime,
          end_time: meeting.endTime,
          building: meeting.building,
          room: meeting.room,
          is_tba: meeting.isTba,
          meeting_type: meeting.meetingType,
          raw_days: meeting.rawDays,
          raw_time: meeting.rawTime,
          raw_location: meeting.rawLocation,
        })),
        enrolled: section.availability.enrolled,
        capacity: section.availability.capacity,
        waitlist_count: section.availability.waitlistCount,
      };
    });

    const groups = buildOfferingGroups(sections);
    rows.push({
      rowId,
      sameCourseId,
      courseCode: first.course.courseCode,
      seasonCode: first.section.supportedTerm as Season,
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

function buildGridTemplate(
  compact: boolean,
  showTermColumn: boolean,
  codeSlotCh: number,
  sectionSlotCh: number,
): string {
  // Invariant: the sum of the column minimums plus gaps, side padding, and
  // the vertical scrollbar must fit the narrowest viewport of the view mode
  // (compact: 900px, full: 1320px), so the grid never scrolls horizontally.
  // The meets column is minmax(px, px): the grid maximizes it to the
  // untruncated "11:00 AM – 1:50 PM" width before any fr track grows, then
  // caps it so the leftover space flows to the title — same effect as
  // upstream CourseTable's clamp()ed meets column.
  const codeCol = `max(${compact ? 86 : 104}px, ${codeSlotCh}ch)`;
  const sectionCol = `max(${compact ? 92 : 132}px, ${sectionSlotCh}ch)`;
  const parts = compact
    ? [
        '32px',
        codeCol,
        sectionCol,
        'minmax(120px, 1.6fr)',
        '72px',
        'minmax(88px, 0.7fr)',
        'minmax(150px, 215px)',
        'minmax(60px, 0.3fr)',
        '64px',
      ]
    : [
        '40px',
        codeCol,
        sectionCol,
        'minmax(200px, 1.7fr)',
        '110px',
        'minmax(124px, 0.9fr)',
        'minmax(215px, 232px)',
        'minmax(72px, 0.6fr)',
        // Snug fit for "20 left" — anything wider reads as dead space on the
        // right edge
        '88px',
      ];
  if (!showTermColumn) parts.splice(4, 1);
  return parts.join(' ');
}

function expandedRowHeight(row: CourseRow): number {
  // Parent row + sub-list border-top + scrollable sub-list + group margin.
  return (
    baseRowHeight +
    1 +
    Math.min(row.totalSections * subRowHeight, subRowsMaxHeight) +
    1
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

function computeViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'full';
  if (window.innerWidth < mobileBreakpoint) return 'mobile';
  if (window.innerWidth < compactBreakpoint) return 'compact';
  return 'full';
}

function useViewMode(): ViewMode {
  const [mode, setMode] = useState<ViewMode>(computeViewMode);

  useEffect(() => {
    const onResize = () => setMode(computeViewMode());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return mode;
}

function useListingInWorksheet(listing: CoursePlanningListing): boolean {
  const {
    activeSavedWorksheet,
    anonymousWorksheet,
    crossTermSavedSections,
    getRelevantWorksheetNumber,
    isAnonymousWorksheet,
    user,
    worksheets,
  } = useStore(
    useShallow((state) => ({
      activeSavedWorksheet: state.activeSavedWorksheet,
      anonymousWorksheet: state.anonymousWorksheet,
      crossTermSavedSections: state.crossTermSavedSections,
      getRelevantWorksheetNumber: state.getRelevantWorksheetNumber,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      user: state.user,
      worksheets: state.worksheets,
    })),
  );
  if (isAnonymousWorksheet)
    return anonymousWorksheetHasListing(anonymousWorksheet, listing);
  if (user && isLegacyUserInfo(user)) {
    const legacy = requireLegacyCatalogListing(
      listing.section.supportedTerm as Season,
      listing.section.sectionId,
    );
    return isInWorksheet(
      legacy,
      getRelevantWorksheetNumber(legacy.course.season_code),
      worksheets,
    );
  }
  return savedWorksheetHasListing(
    activeSavedWorksheet,
    crossTermSavedSections,
    listing,
  );
}

function CatalogWorksheetToggleButton({
  listing,
  appearance,
}: {
  readonly listing: CoursePlanningListing;
  readonly appearance?: 'mobile';
}) {
  const user = useStore((state) => state.user);
  if (user && isLegacyUserInfo(user)) {
    const legacy = requireLegacyCatalogListing(
      listing.section.supportedTerm as Season,
      listing.section.sectionId,
    );
    return (
      <LegacyWorksheetToggleButton
        listing={legacy}
        modal={false}
        appearance={appearance}
      />
    );
  }
  return (
    <CoursePlanningWorksheetToggleButton
      listing={listing}
      modal={false}
      appearance={appearance}
    />
  );
}

function countInstructors(row: CourseRow): number {
  return new Set(
    row.groups.flatMap((g) => g.sections.flatMap((s) => s.instructors)),
  ).size;
}

function countLocations(row: CourseRow): number {
  return new Set(
    row.groups
      .flatMap((g) => [
        ...g.sharedMeetings,
        ...g.sections.flatMap((s) => s.meetings),
      ])
      .map((m) => [m.building, m.room].filter(Boolean).join(' '))
      .filter(Boolean),
  ).size;
}

function findSectionListing(
  row: CourseRow,
  section: OfferingSection,
): CoursePlanningListing {
  return (
    row.listings.find(
      (listing) => listing.section.sectionId === section.section_id,
    ) ?? row.listings[0]!
  );
}

function SortHeader({
  label,
  sortKey,
}: {
  readonly label: string;
  readonly sortKey: CatalogSortKey;
}) {
  const { currentKey, asc, setSort } = useStore(
    useShallow((s) => ({
      currentKey: s.catalogSortKey,
      asc: s.catalogSortAsc,
      setSort: s.setCatalogSort,
    })),
  );
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      className={clsx(styles.headerCell, styles.sortHeader)}
      onClick={() => setSort(sortKey)}
      aria-label={`Sort by ${label}`}
      aria-pressed={active}
    >
      {label}
      <span className={styles.sortIcon} aria-hidden="true">
        {active && !asc ? '▲' : '▼'}
      </span>
    </button>
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

function InstructorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.metaIcon}
      aria-hidden="true"
    >
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.metaIcon}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.metaIcon}
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

type Meeting = {
  raw_days: string | null;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  is_tba: boolean;
};

function MeetingDisplay({ meetings }: { readonly meetings: Meeting[] }) {
  const [first] = meetings;
  if (!first || first.is_tba)
    return <span className={styles.meetTba}>TBA</span>;

  const days = parseDays(first.raw_days ?? '');
  const time = formatTime(first.start_time, first.end_time);
  return (
    <>
      <DayDots days={days} />
      <span className={styles.meetTime}>{time}</span>
    </>
  );
}

function LocationDisplay({ meetings }: { readonly meetings: Meeting[] }) {
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

function FlatRow({
  row,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const group = row.groups[0]!;
  const firstSection = group.sections[0]!;
  const instructor = firstSection.instructors[0] ?? 'Staff';
  const meetings =
    group.sharedMeetings.length > 0
      ? group.sharedMeetings
      : firstSection.meetings;
  const listing = row.listings[0]!;
  const inWorksheet = useListingInWorksheet(listing);

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid row, not a real table
    <div
      className={clsx(styles.row, inWorksheet && styles.rowAdded)}
      onClick={() => onOpenModal(listing)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenModal(listing);
      }}
    >
      <div className={styles.addCell}>
        <CatalogWorksheetToggleButton listing={listing} />
      </div>
      <span className={clsx(styles.cell, styles.courseCode)}>
        {row.courseCode}
      </span>
      <span className={clsx(styles.cell, styles.sectionText)}>
        {firstSection.section_code}
      </span>
      <div className={clsx(styles.cell, styles.titleCell)}>{row.title}</div>
      {showTermColumn && (
        <div className={styles.cell}>
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

function SubRow({
  row,
  group,
  section,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly group: OfferingGroup;
  readonly section: OfferingSection;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const groupListing = findSectionListing(row, section);
  const inWorksheet = useListingInWorksheet(groupListing);
  const { meetings } = section;

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid row, not a real table
    <div
      className={clsx(styles.subRow, inWorksheet && styles.rowAdded)}
      onClick={() => onOpenModal(groupListing)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenModal(groupListing);
      }}
    >
      <div className={styles.addCell}>
        <CatalogWorksheetToggleButton listing={groupListing} />
      </div>
      <div className={styles.cell}>
        <span className={styles.subSectionBadge}>
          {section.section_code ?? group.familyPrefix}
        </span>
      </div>
      <div />
      <div className={clsx(styles.cell, styles.subMeta)}>
        {section.meeting_type && (
          <span className={styles.typeBadge}>
            {section.meeting_type.slice(0, 2).toUpperCase()}
          </span>
        )}
        <SeatsDisplay
          enrolled={section.enrolled}
          capacity={section.capacity}
          variant="subrow"
        />
      </div>
      {showTermColumn && <div />}
      <div className={clsx(styles.cell, styles.subInstructorCell)}>
        {section.instructors[0] ?? 'Staff'}
      </div>
      <div className={clsx(styles.cell, styles.meetsCell)}>
        <MeetingDisplay meetings={meetings} />
      </div>
      <div className={clsx(styles.cell, styles.subLocationCell)}>
        <LocationDisplay meetings={meetings} />
      </div>
      <div />
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
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const { expanded, toggle } = useStore(
    useShallow((s) => ({
      expanded: s.catalogExpandedCourses.has(row.rowId),
      toggle: s.toggleCatalogExpanded,
    })),
  );

  const toggleExpanded = () => toggle(row.rowId);
  const instructorCount = countInstructors(row);
  const locationCount = countLocations(row);
  const subRowsRef = useRef<HTMLDivElement>(null);
  const [subScrollbarWidth, setSubScrollbarWidth] = useState(0);

  useLayoutEffect(() => {
    const el = subRowsRef.current;
    if (!expanded || !el) return undefined;

    const updateScrollbarWidth = () => {
      setSubScrollbarWidth(el.offsetWidth - el.clientWidth);
    };
    updateScrollbarWidth();

    const observer = new ResizeObserver(updateScrollbarWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  const parentRow = (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid row, not a real table
    <div
      className={styles.row}
      role="row"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggleExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') toggleExpanded();
      }}
    >
      <div className={styles.addCell} />
      <span className={clsx(styles.cell, styles.courseCode)}>
        {row.courseCode}
      </span>
      <span className={styles.cell}>
        <span className={styles.sectionBadge}>
          {row.totalSections} sections
          <ChevronIcon open={expanded} />
        </span>
      </span>
      <div className={clsx(styles.cell, styles.titleCell)}>{row.title}</div>
      {showTermColumn && (
        <div className={styles.cell}>
          <TermBadge seasonCode={row.seasonCode} />
        </div>
      )}
      <div className={clsx(styles.cell, styles.summaryText)}>
        {instructorCount === 1
          ? '1 instructor'
          : `${instructorCount} instructors`}
      </div>
      <div className={clsx(styles.cell, styles.summaryText)}>
        Multiple schedules
      </div>
      <div className={clsx(styles.cell, styles.summaryText)}>
        {locationCount === 1 ? '1 location' : `${locationCount} locations`}
      </div>
      <div />
    </div>
  );

  if (!expanded) return parentRow;

  return (
    <div className={styles.expandedGroup}>
      {parentRow}
      <div
        ref={subRowsRef}
        className={styles.subRowContainer}
        style={
          {
            '--ct-sub-scrollbar-w': `${subScrollbarWidth}px`,
          } as CSSProperties
        }
      >
        {row.groups.flatMap((group) =>
          group.sections.map((sec) => (
            <SubRow
              key={sec.section_id}
              row={row}
              group={group}
              section={sec}
              showTermColumn={showTermColumn}
              onOpenModal={onOpenModal}
            />
          )),
        )}
      </div>
    </div>
  );
}

function MobileFlatCard({
  row,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const group = row.groups[0]!;
  const firstSection = group.sections[0]!;
  const instructor = firstSection.instructors[0] ?? 'Staff';
  const meetings =
    group.sharedMeetings.length > 0
      ? group.sharedMeetings
      : firstSection.meetings;
  const listing = row.listings[0]!;
  const inWorksheet = useListingInWorksheet(listing);
  const [firstMeeting] = meetings;
  const isTba = !firstMeeting || firstMeeting.is_tba;

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- clickable card wraps a nested worksheet toggle button
    <div
      className={clsx(styles.mobileCard, inWorksheet && styles.mobileCardAdded)}
      onClick={() => onOpenModal(listing)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenModal(listing);
      }}
    >
      <div className={styles.mobileCardTop}>
        <div className={styles.mobileCardInfo}>
          <div className={styles.mobileCodeRow}>
            <span className={styles.mobileCode}>{row.courseCode}</span>
            {firstSection.section_code && (
              <span className={styles.mobileSectionBadge}>
                {firstSection.section_code}
              </span>
            )}
            {showTermColumn && <TermBadge seasonCode={row.seasonCode} />}
          </div>
          <div className={styles.mobileTitle}>{row.title}</div>
          <div className={styles.mobileInstructor}>
            <InstructorIcon />
            <span className={styles.mobileTrunc}>{instructor}</span>
          </div>
        </div>
        <div className={styles.mobileAddAction}>
          <CatalogWorksheetToggleButton listing={listing} appearance="mobile" />
        </div>
      </div>
      <div className={styles.mobileCardMeta}>
        <div className={styles.mobileMetaRow}>
          <ClockIcon />
          {isTba ? (
            <span className={styles.mobileTba}>Time TBA</span>
          ) : (
            <div className={styles.mobileMeets}>
              <DayDots days={parseDays(firstMeeting.raw_days ?? '')} />
              <span className={styles.mobileTime}>
                {formatTime(firstMeeting.start_time, firstMeeting.end_time)}
              </span>
            </div>
          )}
        </div>
        <div className={styles.mobileMetaSplit}>
          <div className={styles.mobileLocation}>
            <LocationIcon />
            <span className={styles.mobileTrunc}>
              <LocationDisplay meetings={meetings} />
            </span>
          </div>
          <SeatsDisplay
            enrolled={group.totalEnrolled}
            capacity={group.totalCapacity}
          />
        </div>
      </div>
    </div>
  );
}

function MobileSubRow({
  row,
  group,
  section,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly group: OfferingGroup;
  readonly section: OfferingSection;
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const groupListing = findSectionListing(row, section);
  const inWorksheet = useListingInWorksheet(groupListing);
  const { meetings } = section;
  const [firstMeeting] = meetings;
  const isTba = !firstMeeting || firstMeeting.is_tba;

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- clickable row wraps a nested worksheet toggle button
    <div
      className={clsx(styles.mobileSubRow, inWorksheet && styles.rowAdded)}
      onClick={() => onOpenModal(groupListing)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenModal(groupListing);
      }}
    >
      <div className={styles.mobileSubTop}>
        <span className={styles.subSectionBadge}>
          {section.section_code ?? group.familyPrefix}
        </span>
        {section.meeting_type && (
          <span className={styles.typeBadge}>
            {section.meeting_type.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className={styles.mobileSubSpacer} />
        <SeatsDisplay
          enrolled={section.enrolled}
          capacity={section.capacity}
          variant="subrow"
        />
        <div className={styles.mobileAddAction}>
          <CatalogWorksheetToggleButton
            listing={groupListing}
            appearance="mobile"
          />
        </div>
      </div>
      <div className={styles.mobileSubInstructor}>
        <InstructorIcon />
        <span className={styles.mobileTrunc}>
          {section.instructors[0] ?? 'Staff'}
        </span>
      </div>
      <div className={styles.mobileSubMeets}>
        {isTba ? (
          <span className={styles.mobileTba}>TBA</span>
        ) : (
          <>
            <DayDots days={parseDays(firstMeeting.raw_days ?? '')} />
            <span className={styles.mobileTime}>
              {formatTime(firstMeeting.start_time, firstMeeting.end_time)}
            </span>
          </>
        )}
        <div className={styles.mobileSubSpacer} />
        <span className={clsx(styles.mobileSubLocation, styles.mobileTrunc)}>
          <LocationDisplay meetings={meetings} />
        </span>
      </div>
    </div>
  );
}

function MobileExpandableCard({
  row,
  showTermColumn,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly showTermColumn: boolean;
  readonly onOpenModal: (courseListing: CoursePlanningListing) => void;
}) {
  const { expanded, toggle } = useStore(
    useShallow((s) => ({
      expanded: s.catalogExpandedCourses.has(row.rowId),
      toggle: s.toggleCatalogExpanded,
    })),
  );
  const toggleExpanded = () => toggle(row.rowId);
  const instructorCount = countInstructors(row);
  const locationCount = countLocations(row);

  return (
    <div
      className={clsx(
        styles.mobileGroup,
        expanded && styles.mobileGroupExpanded,
      )}
    >
      <button
        type="button"
        className={styles.mobileGroupHeader}
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <div className={styles.mobileCodeRow}>
          <span className={styles.mobileCode}>{row.courseCode}</span>
          <span className={styles.sectionBadge}>
            {row.totalSections} sections
            <ChevronIcon open={expanded} />
          </span>
          {showTermColumn && <TermBadge seasonCode={row.seasonCode} />}
        </div>
        <div className={styles.mobileGroupTitle}>{row.title}</div>
        <div className={styles.mobileGroupMeta}>
          <span>
            <InstructorIcon />
            {instructorCount === 1
              ? '1 instructor'
              : `${instructorCount} instructors`}
          </span>
          <span>
            <LocationIcon />
            {locationCount === 1 ? '1 location' : `${locationCount} locations`}
          </span>
        </div>
      </button>
      {expanded && (
        <div className={styles.mobileSubList}>
          {row.groups.flatMap((group) =>
            group.sections.map((sec) => (
              <MobileSubRow
                key={sec.section_id}
                row={row}
                group={group}
                section={sec}
                onOpenModal={onOpenModal}
              />
            )),
          )}
        </div>
      )}
    </div>
  );
}

export default function CatalogTable({
  data,
  loading,
  filterBar,
  onOpenModal,
}: {
  readonly data: CoursePlanningListing[] | null;
  readonly loading: boolean;
  readonly filterBar: ReactNode;
  readonly onOpenModal: (listing: CoursePlanningListing) => void;
}) {
  const viewMode = useViewMode();
  const rowsRef = useRef<HTMLDivElement>(null);
  const viewportHeight = useElementHeight(rowsRef);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

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
  const showTermColumn = useMemo(
    () => new Set(courseRows.map((row) => row.seasonCode)).size > 1,
    [courseRows],
  );
  const codeSlotCh = useMemo(
    () =>
      courseRows.reduce(
        (max, row) => Math.max(max, row.courseCode.length),
        minCourseCodeWidthCh,
      ) + courseCodeWidthBufferCh,
    [courseRows],
  );
  const sectionSlotCh = useMemo(
    () =>
      String(
        courseRows.reduce((max, row) => Math.max(max, row.totalSections), 1),
      ).length + sectionCountWidthBufferCh,
    [courseRows],
  );
  const gridVars = useMemo(
    () =>
      ({
        '--ct-grid-cols': buildGridTemplate(
          viewMode === 'compact',
          showTermColumn,
          codeSlotCh,
          sectionSlotCh,
        ),
        '--ct-scrollbar-w': `${scrollbarWidth}px`,
      }) as CSSProperties,
    [viewMode, showTermColumn, codeSlotCh, sectionSlotCh, scrollbarWidth],
  );

  // The fixed table header compensates for the rows container's vertical
  // scrollbar so the header columns stay aligned with the row columns.
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return undefined;

    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode, courseRows.length]);

  const rowHeights = useMemo(
    () => courseRows.map((row) => courseRowHeight(row, expandedCourses)),
    [courseRows, expandedCourses],
  );
  const rowOffsets = useMemo(() => prefixOffsets(rowHeights), [rowHeights]);
  const totalRowsHeight = rowOffsets[rowOffsets.length - 1] ?? 0;
  const visibleStart = courseRows.length
    ? Math.max(0, firstVisibleIndex(rowOffsets, scrollTop) - overscanRows)
    : 0;
  const visibleEnd = courseRows.length
    ? Math.min(
        courseRows.length - 1,
        lastVisibleIndex(rowOffsets, scrollTop + viewportHeight) + overscanRows,
      )
    : -1;
  const visibleRows =
    visibleEnd >= visibleStart
      ? courseRows.slice(visibleStart, visibleEnd + 1)
      : [];
  const topSpacerHeight = rowOffsets[visibleStart] ?? 0;
  const bottomSpacerHeight =
    totalRowsHeight - (rowOffsets[visibleEnd + 1] ?? topSpacerHeight);

  const renderDesktopRow = (row: CourseRow) => {
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
  };

  const renderMobileRow = (row: CourseRow) => {
    if (row.totalSections > 1) {
      return (
        <MobileExpandableCard
          key={row.rowId}
          row={row}
          showTermColumn={showTermColumn}
          onOpenModal={onOpenModal}
        />
      );
    }
    return (
      <MobileFlatCard
        key={row.rowId}
        row={row}
        showTermColumn={showTermColumn}
        onOpenModal={onOpenModal}
      />
    );
  };

  return (
    <>
      <div className={styles.controlCard} style={gridVars}>
        {filterBar}
        {viewMode !== 'mobile' && (
          <div className={styles.header}>
            <div className={styles.headerCell} />
            <SortHeader label="Code" sortKey="code" />
            <div className={styles.headerCell} />
            <SortHeader label="Title" sortKey="title" />
            {showTermColumn && <SortHeader label="Term" sortKey="term" />}
            <div className={clsx(styles.headerCell, styles.cell)}>
              {viewMode === 'compact' ? 'Instr.' : 'Instructors'}
            </div>
            <SortHeader label="Meets" sortKey="meets" />
            <div className={clsx(styles.headerCell, styles.cell)}>
              {viewMode === 'compact' ? 'Loc.' : 'Location'}
            </div>
            <div className={styles.headerCell}>Seats</div>
          </div>
        )}
      </div>
      <div
        ref={rowsRef}
        className={clsx(
          styles.rowsContainer,
          viewMode === 'mobile' && styles.rowsContainerMobile,
        )}
        style={gridVars}
        onScroll={
          viewMode === 'mobile'
            ? undefined
            : (event) => setScrollTop(event.currentTarget.scrollTop)
        }
      >
        {loading ? (
          <div className={styles.empty}>Loading courses...</div>
        ) : courseRows.length === 0 ? (
          <div className={styles.empty}>No courses match your filters.</div>
        ) : viewMode === 'mobile' ? (
          courseRows.map(renderMobileRow)
        ) : (
          <div
            className={styles.virtualRows}
            style={{ minHeight: totalRowsHeight }}
          >
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
            {visibleRows.map(renderDesktopRow)}
            {bottomSpacerHeight > 0 && (
              <div style={{ height: bottomSpacerHeight }} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
