import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import DayDots from './DayDots';
import SeatsDisplay from './SeatsDisplay';
import type { CatalogListing } from '../../queries/api';
import type { CatalogSortKey } from '../../slices/CatalogViewSlice';
import { useStore } from '../../store';
import {
  parseDays,
  formatTime,
  buildOfferingGroups,
  type OfferingGroup,
} from '../../utilities/catalogView';
import styles from './CatalogTable.module.css';

type CourseRow = {
  courseId: number;
  courseCode: string;
  title: string;
  groups: OfferingGroup[];
  totalSections: number;
  listings: CatalogListing[];
};

function groupListingsByCourse(listings: CatalogListing[]): CourseRow[] {
  const map = new Map<number, CatalogListing[]>();
  for (const l of listings) {
    const id = l.course.same_course_id;
    const list = map.get(id);
    if (list) list.push(l);
    else map.set(id, [l]);
  }

  const rows: CourseRow[] = [];
  for (const [courseId, group] of map) {
    const first = group[0]!;
    const sections = group.map((l) => {
      const cal = (l.course as { [key: string]: unknown }).ucsd_calendar as
        | { [key: string]: unknown }
        | undefined;
      return {
        section_id: String(
          (cal?.section_id as string | number | undefined) ?? l.crn,
        ),
        course_id: String(courseId),
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
      courseId,
      courseCode: first.course_code,
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

function sortRows(rows: CourseRow[], key: CatalogSortKey, asc: boolean) {
  const sorted = [...rows];
  const dir = asc ? 1 : -1;
  sorted.sort((a, b) => {
    switch (key) {
      case 'code':
        return dir * a.courseCode.localeCompare(b.courseCode);
      case 'title':
        return dir * a.title.localeCompare(b.title);
      case 'meets':
        return dir * (getFirstMeetingTime(a) - getFirstMeetingTime(b));
      default:
        return 0;
    }
  });
  return sorted;
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
    <button
      type="button"
      className={clsx(styles.headerCell, styles.sortable, className)}
      onClick={() => setSort(sortKey)}
    >
      {label}
      <span className={styles.sortIndicator}>{sortDirection}</span>
    </button>
  );
}

function PlusIcon({ size = 18 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 3v12M3 9h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
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

function FlatRow({
  row,
  onAdd,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly onAdd: (courseListing: CatalogListing) => void;
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
        {isSingle && (
          <button
            type="button"
            className={styles.addBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(listing);
            }}
            aria-label="Add to worksheet"
          >
            <PlusIcon />
          </button>
        )}
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
      <div className={clsx(styles.cell, styles.titleCell)}>{row.title}</div>
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
  onAdd,
  onOpenModal,
}: {
  readonly row: CourseRow;
  readonly onAdd: (courseListing: CatalogListing) => void;
  readonly onOpenModal: (courseListing: CatalogListing) => void;
}) {
  const { expanded, toggle } = useStore(
    useShallow((s) => ({
      expanded: s.catalogExpandedCourses.has(row.courseId),
      toggle: s.toggleCatalogExpanded,
    })),
  );

  const listing = row.listings[0]!;
  const toggleExpanded = () => toggle(row.courseId);
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
        {row.title}
      </button>
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
      <div className={styles.subRowContainer}>
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
                  <button
                    type="button"
                    className={styles.subAddBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(groupListing);
                    }}
                    aria-label="Add to worksheet"
                  >
                    <PlusIcon size={16} />
                  </button>
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
  onAdd,
  onOpenModal,
}: {
  readonly data: CatalogListing[] | null;
  readonly onAdd: (listing: CatalogListing) => void;
  readonly onOpenModal: (listing: CatalogListing) => void;
}) {
  const { sortKey, sortAsc } = useStore(
    useShallow((s) => ({
      sortKey: s.catalogSortKey,
      sortAsc: s.catalogSortAsc,
    })),
  );

  const courseRows = useMemo(() => {
    if (!data) return [];
    return sortRows(groupListingsByCourse(data), sortKey, sortAsc);
  }, [data, sortKey, sortAsc]);

  const renderRow = useCallback(
    (row: CourseRow) => {
      if (row.totalSections > 1) {
        return (
          <ExpandableRow
            key={row.courseId}
            row={row}
            onAdd={onAdd}
            onOpenModal={onOpenModal}
          />
        );
      }
      return (
        <FlatRow
          key={row.courseId}
          row={row}
          onAdd={onAdd}
          onOpenModal={onOpenModal}
        />
      );
    },
    [onAdd, onOpenModal],
  );

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableInner}>
        <div className={styles.header}>
          <div className={clsx(styles.headerCell, styles.colAdd)} />
          <SortHeader label="Code" sortKey="code" className={styles.colCode} />
          <SortHeader
            label="Title"
            sortKey="title"
            className={styles.colTitle}
          />
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
          <div className={clsx(styles.headerCell, styles.colSeats)}>Seats</div>
        </div>

        {courseRows.length === 0 ? (
          <div className={styles.empty}>No courses match your filters.</div>
        ) : (
          courseRows.map(renderRow)
        )}
      </div>
    </div>
  );
}
