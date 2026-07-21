import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import clsx from 'clsx';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import {
  isUcsdInfoMeeting,
  ucsdMeetingTypeCode,
  ucsdMeetingTypeLabel,
} from './ucsdMeetingTypes';
import UcsdSnapshotGradeDistribution from './UcsdSnapshotGradeDistribution';
import {
  buildUcsdSnapshotModalCourse,
  formatSnapshotUpdatedLabel,
  formatUcsdAvailability,
  getSectionVaryingMeetings,
  shouldShowUcsdSectionSelector,
  type UcsdModalListing,
  type UcsdModalOfferingGroup,
  type UcsdModalSection,
} from './ucsdSnapshotModalData';
import { isWorksheetTerm } from '../../data/catalogSeasons';
import { useCoursePlanningCatalog } from '../../hooks/useCoursePlanning';
import { useModalHistory } from '../../hooks/useModalHistory';
import { useWorksheetListingSelection } from '../../hooks/useWorksheetListingSelection';
import type { CoursePlanningCourse } from '../../queries/coursePlanningViewModels';
import {
  fall2026Term,
  type Fa26SectionMappingEntry,
} from '../../queries/fa26SectionMapping';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import {
  formatTime,
  parseDays,
  type DayFlags,
} from '../../utilities/catalogView';
import {
  toSeasonDate,
  toSeasonString,
  truncatedText,
} from '../../utilities/course';
import styles from './UcsdSnapshotCourseModal.module.css';

type UcsdModalView = 'overview' | 'evals' | 'past-grades' | 'section-mapping';
type UcsdModalHeaderMenu = 'section' | 'more';

const courseActionToastDuration = 800;

const weekdayLabels: (keyof DayFlags)[] = ['M', 'Tu', 'W', 'Th', 'F'];
const weekLabels: (keyof DayFlags)[] = [...weekdayLabels, 'Sa', 'Su'];

const typeClass = {
  AC: styles.typeActivity,
  CL: styles.typeInstruction,
  CO: styles.typeInstruction,
  LE: styles.typeLE,
  DI: styles.typeDI,
  LA: styles.typeLA,
  FI: styles.typeFI,
  FM: styles.typeInstruction,
  FW: styles.typeInstruction,
  IN: styles.typeInstruction,
  IT: styles.typeInstruction,
  MI: styles.typeMI,
  MU: styles.typeInfo,
  OT: styles.typeInfo,
  PB: styles.typeInstruction,
  PR: styles.typeInstruction,
  RE: styles.typeRE,
  SE: styles.typeInstruction,
  ST: styles.typeInstruction,
  TU: styles.typeInstruction,
};

function CloseIcon({ size = 20 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  );
}

function PlusIcon({ size = 18 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="9" y1="3" x2="9" y2="15" />
      <line x1="3" y1="9" x2="15" y2="9" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 17 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 10.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
      <polyline points="5.5 6 8.5 3 11.5 6" />
      <line x1="8.5" y1="3" x2="8.5" y2="11" />
    </svg>
  );
}

function SectionMappingIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 17 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="6.25" />
      <line x1="8.5" y1="5" x2="8.5" y2="9.25" />
      <circle cx="8.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ReportIssueIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 17 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="14.5" x2="4" y2="3" />
      <path d="M4 3.5h7l-1.25 2.25L11 8H4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 17 17"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="8.5" r="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <circle cx="13.5" cy="8.5" r="1.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 7L7 3M7 3H4.5M7 3V5.5" />
    </svg>
  );
}

function ChevronIcon({
  open,
  size = 10,
  className,
}: {
  readonly open: boolean;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg
      className={clsx(styles.chevron, open && styles.chevronOpen, className)}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <polyline points="2.5,3.5 5,6.5 7.5,3.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className={styles.sectionMenuCheck}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="2.5,7.5 6,11 11.5,3.5" />
    </svg>
  );
}

function copyCourseUrl() {
  navigator.clipboard.writeText(window.location.href).then(
    () =>
      toast.success('Course URL copied', {
        duration: courseActionToastDuration,
      }),
    () => toast.error('Failed to copy course URL'),
  );
}

function ModalDayDots({
  rawDays,
  allowWeekend = false,
}: {
  readonly rawDays: string | null;
  readonly allowWeekend?: boolean;
}) {
  const days = parseDays(rawDays ?? '');
  const activeIndex = weekLabels.findIndex((day) => days[day]);
  const windowStart =
    allowWeekend && activeIndex >= weekdayLabels.length
      ? Math.max(0, activeIndex - weekdayLabels.length + 1)
      : 0;
  const labels = weekLabels.slice(
    windowStart,
    windowStart + weekdayLabels.length,
  );
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

function formatExamRowDate(date: string | null | undefined): string | null {
  const [yearText, monthText, dayText] = date?.split('-') ?? [];
  if (!yearText || !monthText || !dayText) return null;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const value = new Date(year, month - 1, day);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day
  )
    return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function locationText(meeting: UcsdModalSection['meetings'][number]): string {
  if (meeting.rawLocation) return meeting.rawLocation;
  if (meeting.isTba) return 'TBA';
  const parts = [meeting.building, meeting.room].filter(Boolean);
  return parts.join(' ') || 'TBA';
}

function sectionLabel(
  group: UcsdModalOfferingGroup,
  mapping?: Fa26SectionMappingEntry,
): string {
  if (mapping) return mapping.displayName;
  return group.familyPrefix ? `Section ${group.familyPrefix}` : 'Section';
}

function sectionShortLabel(
  section: UcsdModalSection,
  mapping?: Fa26SectionMappingEntry,
) {
  return (
    mapping?.displayOption ??
    mapping?.displaySection ??
    section.sectionCode ??
    ''
  );
}

function anchorSectionCode(group: UcsdModalOfferingGroup): string {
  if (group.familyPrefix && /^[A-Z]$/u.test(group.familyPrefix))
    return `${group.familyPrefix}00`;
  return group.sections[0]?.sectionCode ?? group.familyPrefix;
}

function groupInstructor(group: UcsdModalOfferingGroup): string {
  const names = [
    ...new Set(
      group.sections.flatMap((section) =>
        section.instructors.map(({ name }) => name),
      ),
    ),
  ].filter(Boolean);
  if (names.length === 0) return 'Staff';
  if (names.length === 1) return names[0]!;
  return `${names.length} instructors`;
}

function groupSubtitle(group: UcsdModalOfferingGroup): string {
  const meeting = group.sharedMeetings[0] ?? group.sections[0]?.meetings[0];
  if (!meeting || meeting.isTba) return 'Schedule TBA';
  return formatTime(meeting.startTime, meeting.endTime);
}

function courseLevelLabel(number: string): string | null {
  const match = /\d+/u.exec(number);
  if (!match) return null;
  const value = Number(match[0]);
  if (value >= 200) return 'Graduate';
  if (value >= 100) return 'Upper Division';
  return 'Lower Division';
}

function unitsLabel(course: CoursePlanningCourse) {
  const { units } = course;
  if (units === null || units === '') return null;
  const text = String(units);
  return /unit/iu.test(text) ? text : `${text} Units`;
}

function selectedSectionForGroup(
  group: UcsdModalOfferingGroup,
  selectedCode: string | null | undefined,
) {
  if (!selectedCode) return null;
  return (
    group.sections.find((section) => section.sectionCode === selectedCode) ??
    null
  );
}

type MeetingRowData = {
  key: string;
  role: 'anchor' | 'selectable' | 'info';
  meeting: UcsdModalSection['meetings'][number];
  section: UcsdModalSection | null;
  sectionCode: string;
  usesFriendlySectionCode: boolean;
};

function buildMeetingRows(
  group: UcsdModalOfferingGroup,
  sectionMapping?: ReadonlyMap<string, Fa26SectionMappingEntry>,
): MeetingRowData[] {
  const rows: MeetingRowData[] = group.sharedMeetings.map((meeting, index) => ({
    key: `${group.familyPrefix}-shared-${index}`,
    role: isUcsdInfoMeeting(meeting.meetingType) ? 'info' : 'anchor',
    meeting,
    section: null,
    sectionCode: anchorSectionCode(group),
    usesFriendlySectionCode: false,
  }));

  for (const section of group.sections) {
    const meetings =
      group.sections.length === 1
        ? section.meetings
        : getSectionVaryingMeetings(section, group);
    for (const [index, meeting] of meetings.entries()) {
      const role = isUcsdInfoMeeting(meeting.meetingType)
        ? 'info'
        : group.sections.length > 1
          ? 'selectable'
          : 'anchor';
      rows.push({
        key: `${section.sectionId}-${index}`,
        role,
        meeting,
        section,
        sectionCode: sectionShortLabel(
          section,
          sectionMapping?.get(section.sectionId),
        ),
        usesFriendlySectionCode:
          sectionMapping?.has(section.sectionId) ?? false,
      });
    }
  }

  return rows;
}

function separatorLabel(row: MeetingRowData): string {
  return `Choose ${ucsdMeetingTypeLabel(row.meeting.meetingType).toLowerCase()}`;
}

function shouldShowSeparator(rows: MeetingRowData[], index: number): boolean {
  const row = rows[index]!;
  const previous = rows[index - 1];
  if (row.role === 'selectable')
    return !previous || previous.role !== 'selectable';
  return false;
}

function MeetingRow({
  row,
  group,
  selected,
  updatedLabel,
  onSelect,
}: {
  readonly row: MeetingRowData;
  readonly group: UcsdModalOfferingGroup;
  readonly selected: boolean;
  readonly updatedLabel: string | null;
  readonly onSelect: (section: UcsdModalSection) => void;
}) {
  const code = ucsdMeetingTypeCode(row.meeting.meetingType);
  const availability =
    row.role !== 'info' && row.section
      ? formatUcsdAvailability(
          row.section.availability.enrolled,
          row.section.availability.capacity,
          row.section.availability.waitlistCount,
          row.section.availability.availableSeats,
          row.section.availability.capacityKind,
        )
      : null;
  const meetingTime = formatTime(row.meeting.startTime, row.meeting.endTime);
  const rowClassName = clsx(
    styles.meetingRow,
    row.usesFriendlySectionCode && styles.friendlyMeetingRow,
    row.role === 'selectable' && styles.selectableRow,
    selected && styles.selectedRow,
  );
  const examDate =
    row.role === 'info' ? formatExamRowDate(row.meeting.date) : null;

  const content = (
    <>
      <div className={styles.radioSlot}>
        {row.role === 'selectable' && row.section && (
          <input
            type="radio"
            className={styles.radio}
            name={`course-modal-${group.familyPrefix}`}
            checked={selected}
            onChange={() => onSelect(row.section!)}
            aria-label={`Select ${row.sectionCode}`}
          />
        )}
      </div>
      <div className={styles.typeCell}>
        <span
          className={clsx(
            styles.typeBadge,
            typeClass[code as keyof typeof typeClass] ?? styles.typeInstruction,
          )}
        >
          {code}
        </span>
        <span className={styles.typeLabel}>
          {ucsdMeetingTypeLabel(row.meeting.meetingType)}
        </span>
      </div>
      <div
        className={clsx(
          styles.sectionCode,
          row.usesFriendlySectionCode && styles.friendlySectionCode,
        )}
      >
        {row.sectionCode}
      </div>
      <div className={styles.meetingTime}>
        {!row.meeting.isTba && (
          <ModalDayDots
            rawDays={row.meeting.rawDays}
            allowWeekend={row.role === 'info'}
          />
        )}
        <span className={styles.timeText}>{meetingTime}</span>
      </div>
      <div className={styles.location}>{locationText(row.meeting)}</div>
      <div
        className={clsx(
          styles.availability,
          row.role === 'info' && styles.examDate,
          availability?.status === 'critical' && styles.availabilityCritical,
          availability?.status === 'low' && styles.availabilityLow,
          availability?.status === 'medium' && styles.availabilityMedium,
          availability?.status === 'high' && styles.availabilityHigh,
          availability?.status === 'available' && styles.availabilityAvailable,
          availability?.status === 'full' && styles.availabilityFull,
        )}
      >
        {examDate}
        {availability?.main}
        {availability?.detail && (
          <span className={styles.availabilityDetail}>
            {availability.detail}
          </span>
        )}
        {availability && updatedLabel && (
          <span className={styles.updatedLabel}>{updatedLabel}</span>
        )}
      </div>
    </>
  );

  if (row.role === 'selectable')
    return <label className={rowClassName}>{content}</label>;

  return <div className={rowClassName}>{content}</div>;
}

type OfferingGroupCardModel = {
  group: UcsdModalOfferingGroup;
  active: boolean;
  canEditWorksheet: boolean;
  mappingEntry?: Fa26SectionMappingEntry;
  inWorksheet: boolean;
  selectedCode: string | null | undefined;
  updatedLabel: string | null;
  worksheetDisabled: boolean;
};

type OfferingGroupCardActions = {
  onSelect: (
    targetGroup: UcsdModalOfferingGroup,
    section: UcsdModalSection,
  ) => void;
  onAdd: (listing: UcsdModalListing) => void;
  onToggleWorksheet: (listing: UcsdModalListing) => void;
  setRef: (node: HTMLDivElement | null) => void;
};

export function OfferingGroupCard({
  model,
  actions,
}: {
  readonly model: OfferingGroupCardModel;
  readonly actions: OfferingGroupCardActions;
}) {
  const {
    group,
    active,
    canEditWorksheet,
    mappingEntry,
    inWorksheet,
    selectedCode,
    updatedLabel,
    worksheetDisabled,
  } = model;
  const { onSelect, onAdd, onToggleWorksheet, setRef } = actions;
  const sectionMapping = mappingEntry
    ? new Map([[mappingEntry.packageId, mappingEntry]])
    : undefined;
  const rows = buildMeetingRows(group, sectionMapping);
  const selectedSection =
    group.sections.length === 1
      ? group.sections[0]
      : selectedSectionForGroup(group, selectedCode);
  const selectedForAdd = selectedSection ?? null;

  return (
    <div
      ref={setRef}
      className={clsx(
        styles.card,
        active && styles.cardActive,
        inWorksheet && styles.cardInWorksheet,
      )}
      data-course-modal-family={group.familyPrefix}
    >
      <div className={styles.cardHeader}>
        <div>
          <div
            className={clsx(
              styles.cardTitle,
              mappingEntry && styles.friendlyCardTitle,
            )}
          >
            {sectionLabel(group, mappingEntry)}
          </div>
          <div className={styles.cardSubTitle}>{groupSubtitle(group)}</div>
        </div>
        <div className={styles.cardInstructor}>{groupInstructor(group)}</div>
      </div>

      {rows.map((row, index) => (
        <div key={row.key}>
          {shouldShowSeparator(rows, index) && (
            <div className={styles.rowSeparator}>{separatorLabel(row)}</div>
          )}
          <MeetingRow
            row={row}
            group={group}
            selected={
              row.role === 'selectable' &&
              Boolean(row.section?.sectionCode) &&
              row.section?.sectionCode === selectedCode
            }
            updatedLabel={updatedLabel}
            onSelect={(section) => onSelect(group, section)}
          />
        </div>
      ))}

      {canEditWorksheet &&
        (selectedForAdd ? (
          <div className={styles.cardAction}>
            <button
              type="button"
              className={clsx(
                styles.addButton,
                inWorksheet && styles.removeButton,
              )}
              disabled={Boolean(mappingEntry && worksheetDisabled)}
              onClick={() =>
                mappingEntry
                  ? onToggleWorksheet(selectedForAdd.listing)
                  : onAdd(selectedForAdd.listing)
              }
            >
              {inWorksheet ? (
                <span aria-hidden="true">✓</span>
              ) : (
                <PlusIcon size={14} />
              )}
              {inWorksheet ? 'Remove' : 'Add'}{' '}
              {mappingEntry?.displayName ??
                selectedForAdd.sectionCode ??
                group.familyPrefix}{' '}
              {inWorksheet ? 'from' : 'to'} Worksheet
            </button>
          </div>
        ) : (
          <div className={styles.noSelection}>
            Select a{' '}
            {ucsdMeetingTypeLabel(
              rows.find((row) => row.role === 'selectable')?.meeting
                .meetingType,
            ).toLowerCase()}{' '}
            section to add this group
          </div>
        ))}
    </div>
  );
}

function mappingSchedule(listing: UcsdModalListing) {
  return listing.section.meetings
    .filter((meeting) => !isUcsdInfoMeeting(meeting.meetingType))
    .map((meeting) => {
      const days = meeting.isTba ? 'TBA' : meeting.rawDays || 'TBA';
      const time = formatTime(meeting.startTime, meeting.endTime);
      const location = locationText(meeting);
      return `${ucsdMeetingTypeCode(meeting.meetingType)} · ${days} ${time} · ${location}`;
    });
}

function SectionMappingTable({
  entries,
  listingsBySectionId,
  hasListing,
  onToggle,
  disabled,
}: {
  readonly entries: Fa26SectionMappingEntry[];
  readonly listingsBySectionId: ReadonlyMap<string, UcsdModalListing>;
  readonly hasListing: (listing: UcsdModalListing) => boolean;
  readonly onToggle: (listing: UcsdModalListing) => void;
  readonly disabled: boolean;
}) {
  return (
    <section
      className={styles.mappingPanel}
      aria-labelledby="section-mapping-title"
    >
      <div className={styles.mappingIntro}>
        <div>
          <h2 id="section-mapping-title" className={styles.mappingTitle}>
            Section Mapping
          </h2>
          <p className={styles.mappingDescription}>
            Choose a section to add to your Worksheet. SunGrid shows the section
            name; UCSD uses the TSS section.
          </p>
        </div>
        <span className={styles.mappingCount}>
          {entries.length} {entries.length === 1 ? 'section' : 'sections'}
        </span>
      </div>
      <div className={styles.mappingTableWrap}>
        <table className={styles.mappingTable}>
          <thead>
            <tr>
              <th className={styles.mappingSelectHeader}>Add</th>
              <th className={styles.mappingNameHeader}>Section name</th>
              <th className={styles.mappingOfficialHeader}>TSS section</th>
              <th className={styles.mappingInstructorHeader}>Instructor</th>
              <th className={styles.mappingScheduleHeader}>Schedule</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const target = listingsBySectionId.get(entry.packageId);
              if (!target) return null;
              const selected = hasListing(target);
              const instructors = target.section.instructors
                .map(({ name }) => name)
                .filter(Boolean)
                .join(', ');
              const schedules = mappingSchedule(target);
              return (
                <tr
                  key={entry.packageId}
                  className={selected ? styles.mappingRowSelected : undefined}
                >
                  <td className={styles.mappingSelectCell}>
                    <input
                      type="checkbox"
                      className={styles.mappingCheckbox}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => onToggle(target)}
                      aria-label={`${selected ? 'Remove' : 'Add'} ${entry.displayName} ${selected ? 'from' : 'to'} Worksheet`}
                    />
                  </td>
                  <td data-label="Section">
                    <span className={styles.mappingDisplayName}>
                      {entry.displayName}
                    </span>
                  </td>
                  <td data-label="TSS section">
                    <code className={styles.mappingOfficialCode}>
                      {entry.officialSectionCode}
                    </code>
                  </td>
                  <td
                    className={styles.mappingInstructor}
                    data-label="Instructor"
                  >
                    {instructors || 'Staff'}
                  </td>
                  <td data-label="Schedule">
                    <ul className={styles.mappingScheduleList}>
                      {schedules.length > 0 ? (
                        schedules.map((schedule, index) => (
                          <li key={`${entry.packageId}-${index}`}>
                            {schedule}
                          </li>
                        ))
                      ) : (
                        <li>Schedule TBA</li>
                      )}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function UcsdSnapshotCourseModal({
  listing,
}: {
  readonly listing: UcsdModalListing;
}) {
  const [view, setView] = useState<UcsdModalView>('overview');
  const titleId = useId();
  const sectionMappingTooltipId = useId();
  const modalRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [family: string]: HTMLDivElement | null }>({});
  const sectionSelectButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [openHeaderMenu, setOpenHeaderMenu] =
    useState<UcsdModalHeaderMenu | null>(null);
  const openHeaderMenuRef = useRef(openHeaderMenu);
  openHeaderMenuRef.current = openHeaderMenu;
  const sectionMenuOpen = openHeaderMenu === 'section';
  const moreMenuOpen = openHeaderMenu === 'more';
  const [scrollTarget, setScrollTarget] = useState<{
    family: string;
    nonce: number;
  } | null>(null);
  const { closeModal } = useModalHistory();
  const { courses } = useCoursePlanningCatalog();
  const season = listing.section.supportedTerm as Season;
  const canEditWorksheet = isWorksheetTerm(season);
  const allListings = useMemo(
    () => [...(courses[season]?.listings.values() ?? [])],
    [courses, season],
  );
  const modalCourse = useMemo(
    () => buildUcsdSnapshotModalCourse(listing, allListings),
    [allListings, listing],
  );
  const isFall2026 = season === fall2026Term;
  const listingsBySectionId = useMemo(
    () =>
      new Map(
        modalCourse.listings.map((courseListing) => [
          courseListing.section.sectionId,
          courseListing,
        ]),
      ),
    [modalCourse.listings],
  );
  const {
    disabled: worksheetDisabled,
    hasListing: worksheetHasListing,
    toggleListing: toggleWorksheetListing,
  } = useWorksheetListingSelection();
  const {
    activeFamilyState,
    selectedSections,
    prereqExpanded,
    resetCourseModalUI,
    setCourseModalActiveFamily,
    selectCourseModalSection,
    toggleCourseModalPrerequisites,
    setCourseModalPrerequisitesExpanded,
    addAnonymousWorksheetListing,
    addActiveSavedWorksheetListing,
    authStatus,
  } = useStore(
    useShallow((state) => ({
      activeFamilyState: state.courseModalActiveFamily,
      selectedSections: state.courseModalSelectedSections,
      prereqExpanded: state.courseModalPrerequisitesExpanded,
      resetCourseModalUI: state.resetCourseModalUI,
      setCourseModalActiveFamily: state.setCourseModalActiveFamily,
      selectCourseModalSection: state.selectCourseModalSection,
      toggleCourseModalPrerequisites: state.toggleCourseModalPrerequisites,
      setCourseModalPrerequisitesExpanded:
        state.setCourseModalPrerequisitesExpanded,
      addAnonymousWorksheetListing: state.addAnonymousWorksheetListing,
      addActiveSavedWorksheetListing: state.addActiveSavedWorksheetListing,
      authStatus: state.authStatus,
    })),
  );

  useEffect(() => {
    resetCourseModalUI(
      modalCourse.activeFamily || null,
      modalCourse.selectedSectionCode
        ? { [modalCourse.activeFamily]: modalCourse.selectedSectionCode }
        : {},
    );
  }, [
    listing.section.sectionId,
    listing.section.supportedTerm,
    modalCourse.activeFamily,
    modalCourse.selectedSectionCode,
    resetCourseModalUI,
  ]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        const openMenu = openHeaderMenuRef.current;
        if (openMenu) {
          setOpenHeaderMenu(null);
          const trigger =
            openMenu === 'section'
              ? sectionSelectButtonRef.current
              : moreMenuButtonRef.current;
          trigger?.focus();
          return;
        }
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusable = [
        ...modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [closeModal]);

  const activeFamily = activeFamilyState ?? modalCourse.activeFamily;
  const currentView =
    view === 'past-grades' || (view === 'section-mapping' && isFall2026)
      ? view
      : 'overview';
  const updatedLabel = formatSnapshotUpdatedLabel(
    listing.section.availability.snapshotTimestamp ?? listing.generatedAt,
  );
  const units = unitsLabel(listing.course);
  const level = courseLevelLabel(listing.course.courseNumber);
  const hasRestrictions = Boolean(listing.course.restrictions);
  const titleSection =
    modalCourse.sectionMapping.bySectionId.get(listing.section.sectionId)
      ?.displayName ??
    listing.section.sectionCode ??
    '';
  const title = `${listing.course.courseCode} ${titleSection}: ${listing.course.title} - UCSD ${toSeasonString(season)} | UCSD Course Planner`;
  const description = truncatedText(
    listing.course.description,
    300,
    'No description available',
  );
  const structuredJSON = JSON.stringify({
    '@context': 'https://schema.org/',
    name: { title },
    description: { description },
    datePublished: toSeasonDate(season),
  });

  useEffect(() => {
    if (!scrollTarget) return;
    const body = bodyRef.current;
    const card = cardRefs.current[scrollTarget.family];
    if (!body || !card) return;
    const delta =
      card.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const maxTop = body.scrollHeight - body.clientHeight;
    const top = Math.max(0, Math.min(maxTop, body.scrollTop + delta - 12));
    body.scrollTo({ top, behavior: 'smooth' });
  }, [scrollTarget]);

  const closeHeaderMenu = (menu: UcsdModalHeaderMenu) => {
    setOpenHeaderMenu(null);
    const trigger =
      menu === 'section'
        ? sectionSelectButtonRef.current
        : moreMenuButtonRef.current;
    // The menu unmounts with the focused item in it; return focus to the
    // trigger so Tab order and the dialog's Escape handler keep working.
    trigger?.focus();
  };

  const handleSelectFamily = (family: string) => {
    setCourseModalActiveFamily(family);
    closeHeaderMenu('section');
    setView('overview');
    setScrollTarget((previous) => ({
      family,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };

  const handleSelectSection = (
    group: UcsdModalOfferingGroup,
    section: UcsdModalSection,
  ) => {
    if (!section.sectionCode) return;
    selectCourseModalSection(group.familyPrefix, section.sectionCode);
  };

  const handleAdd = useCallback(
    (target: UcsdModalListing) => {
      if (!canEditWorksheet) return;
      const colors = [
        '#7B68EE',
        '#FF6B6B',
        '#4CAF50',
        '#FF9800',
        '#2196F3',
        '#E91E63',
      ];
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      const label =
        `${target.course.courseCode} ${target.section.sectionCode ?? ''}`.trim();
      if (authStatus === 'authenticated') {
        void addActiveSavedWorksheetListing(target, color).then(
          (savedAdded) => {
            if (savedAdded) {
              toast.success(`Added ${label} to worksheet`, {
                duration: courseActionToastDuration,
              });
            }
          },
        );
        return;
      }
      const added = addAnonymousWorksheetListing(target, color);
      if (added) {
        toast.success(`Added ${label} to worksheet`, {
          duration: courseActionToastDuration,
        });
      }
    },
    [
      addActiveSavedWorksheetListing,
      addAnonymousWorksheetListing,
      authStatus,
      canEditWorksheet,
    ],
  );

  const handleToggleWorksheet = useCallback(
    (target: UcsdModalListing) => {
      if (!canEditWorksheet) return;
      void toggleWorksheetListing(target).catch((error: unknown) =>
        Sentry.captureException(error),
      );
    },
    [canEditWorksheet, toggleWorksheetListing],
  );

  const activeGroup = modalCourse.groups.find(
    (group) => group.familyPrefix === activeFamily,
  );
  const activeSelected =
    activeGroup &&
    (selectedSectionForGroup(
      activeGroup,
      selectedSections[activeGroup.familyPrefix],
    ) ??
      activeGroup.sections[0]);
  const activeMapping = activeSelected
    ? modalCourse.sectionMapping.bySectionId.get(activeSelected.sectionId)
    : undefined;
  const shouldShowSectionSelector = shouldShowUcsdSectionSelector(
    modalCourse.groups,
  );

  return (
    <div className={styles.backdrop}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <script className="structured-data-list" type="application/ld+json">
          {structuredJSON}
        </script>
      </Helmet>
      <button
        type="button"
        className={styles.backdropButton}
        onClick={closeModal}
        aria-label="Close course details"
      />
      <dialog
        ref={modalRef}
        className={styles.modal}
        aria-labelledby={titleId}
        open
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              <div id={titleId} className={styles.title}>
                {listing.course.title}
              </div>
              <div className={styles.subtitleRow}>
                <span className={styles.courseCode}>
                  {listing.course.courseCode}
                </span>
                <span className={styles.subtitleDot} aria-hidden="true" />
                <span>{toSeasonString(season)}</span>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={closeModal}
              aria-label="Close course details"
            >
              <CloseIcon />
            </button>
          </div>

          <div
            className={clsx(
              styles.controls,
              !shouldShowSectionSelector && styles.controlsSingleRow,
            )}
          >
            <div className={styles.tabs}>
              <button
                type="button"
                className={clsx(
                  styles.tab,
                  currentView === 'overview' && styles.tabActive,
                )}
                aria-current={currentView === 'overview'}
                onClick={() => setView('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={clsx(
                  styles.tab,
                  currentView === 'past-grades' && styles.tabActive,
                )}
                aria-current={currentView === 'past-grades'}
                onClick={() => setView('past-grades')}
              >
                Past Grades
              </button>
              {isFall2026 && (
                <button
                  type="button"
                  className={clsx(
                    styles.tab,
                    currentView === 'section-mapping' && styles.tabActive,
                  )}
                  aria-current={
                    currentView === 'section-mapping' ? 'page' : undefined
                  }
                  onClick={() => setView('section-mapping')}
                >
                  Section Mapping
                </button>
              )}
            </div>
            <div className={styles.controlsRight}>
              {shouldShowSectionSelector && (
                <div className={styles.sectionSelect}>
                  <button
                    ref={sectionSelectButtonRef}
                    type="button"
                    className={clsx(
                      styles.sectionSelectButton,
                      sectionMenuOpen && styles.sectionSelectButtonOpen,
                    )}
                    onClick={() => {
                      setOpenHeaderMenu(sectionMenuOpen ? null : 'section');
                    }}
                    aria-haspopup="menu"
                    aria-expanded={sectionMenuOpen}
                  >
                    <span className={styles.sectionSelectLabel}>
                      {activeGroup
                        ? sectionLabel(activeGroup, activeMapping)
                        : 'Section'}
                    </span>
                    <ChevronIcon
                      open={sectionMenuOpen}
                      size={11}
                      className={styles.selectChevron}
                    />
                  </button>
                  {sectionMenuOpen && (
                    <>
                      <button
                        type="button"
                        className={styles.sectionMenuBackdrop}
                        onClick={() => closeHeaderMenu('section')}
                        aria-label="Close section menu"
                        tabIndex={-1}
                      />
                      <div className={styles.sectionMenu} role="menu">
                        {modalCourse.groups.map((group) => {
                          const isActive = activeFamily === group.familyPrefix;
                          const [target] = group.sections;
                          const mapping = target
                            ? modalCourse.sectionMapping.bySectionId.get(
                                target.sectionId,
                              )
                            : undefined;
                          const inWorksheet = target
                            ? worksheetHasListing(target.listing)
                            : false;
                          if (isFall2026 && target && mapping) {
                            return (
                              <div
                                key={group.familyPrefix}
                                className={clsx(
                                  styles.sectionMenuItem,
                                  styles.sectionMenuItemWithToggle,
                                  isActive && styles.sectionMenuItemActive,
                                )}
                                role="none"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={styles.sectionMenuNavigation}
                                  onClick={() =>
                                    handleSelectFamily(group.familyPrefix)
                                  }
                                >
                                  <span className={styles.sectionMenuText}>
                                    <span className={styles.sectionMenuTitle}>
                                      {mapping.displayName}
                                    </span>
                                    <span
                                      className={styles.sectionMenuInstructor}
                                    >
                                      {groupInstructor(group)}
                                    </span>
                                  </span>
                                </button>
                                <input
                                  type="checkbox"
                                  className={styles.sectionMenuCheckbox}
                                  checked={inWorksheet}
                                  disabled={worksheetDisabled}
                                  onChange={() =>
                                    handleToggleWorksheet(target.listing)
                                  }
                                  aria-label={`${inWorksheet ? 'Remove' : 'Add'} ${mapping.displayName} ${inWorksheet ? 'from' : 'to'} Worksheet`}
                                />
                              </div>
                            );
                          }
                          return (
                            <button
                              key={group.familyPrefix}
                              type="button"
                              role="menuitem"
                              className={clsx(
                                styles.sectionMenuItem,
                                isActive && styles.sectionMenuItemActive,
                              )}
                              onClick={() =>
                                handleSelectFamily(group.familyPrefix)
                              }
                            >
                              <span className={styles.sectionMenuText}>
                                <span className={styles.sectionMenuTitle}>
                                  {sectionLabel(group, mapping)}
                                </span>
                                <span className={styles.sectionMenuInstructor}>
                                  {groupInstructor(group)}
                                </span>
                              </span>
                              {isActive && <CheckIcon />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className={styles.toolbar}>
                <div className={styles.toolbarMenu}>
                  <button
                    ref={moreMenuButtonRef}
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      setOpenHeaderMenu(moreMenuOpen ? null : 'more');
                    }}
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={moreMenuOpen}
                  >
                    <MoreIcon />
                  </button>
                  {moreMenuOpen && (
                    <>
                      <button
                        type="button"
                        className={styles.sectionMenuBackdrop}
                        onClick={() => closeHeaderMenu('more')}
                        aria-label="Close more actions menu"
                        tabIndex={-1}
                      />
                      <div className={styles.toolbarMenuPopover} role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.toolbarMenuItem}
                          onClick={() => {
                            copyCourseUrl();
                            closeHeaderMenu('more');
                          }}
                        >
                          <ShareIcon />
                          <span>Copy course URL</span>
                        </button>
                        <a
                          role="menuitem"
                          className={styles.toolbarMenuItem}
                          href="https://tally.so/r/aQPrYW"
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => closeHeaderMenu('more')}
                        >
                          <ReportIssueIcon />
                          <span>Report a course issue</span>
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.separator} />
        </div>

        <div ref={bodyRef} className={styles.body}>
          {currentView === 'past-grades' ? (
            <UcsdSnapshotGradeDistribution
              records={listing.course.pastGrades}
            />
          ) : currentView === 'section-mapping' ? (
            <SectionMappingTable
              entries={modalCourse.sectionMapping.entries}
              listingsBySectionId={listingsBySectionId}
              hasListing={worksheetHasListing}
              onToggle={handleToggleWorksheet}
              disabled={worksheetDisabled}
            />
          ) : (
            <>
              <p className={styles.description}>
                {listing.course.description || 'No description available.'}
              </p>

              <div className={styles.chips}>
                {units && (
                  <span className={clsx(styles.chip, styles.unitsChip)}>
                    {units}
                  </span>
                )}
                {level && (
                  <span className={clsx(styles.chip, styles.levelChip)}>
                    {level}
                  </span>
                )}
                {hasRestrictions && (
                  <span className={clsx(styles.chip, styles.restrictionChip)}>
                    Restrictions
                  </span>
                )}
                {listing.course.prerequisites && (
                  <button
                    type="button"
                    className={clsx(
                      styles.chipButton,
                      prereqExpanded && styles.chipButtonExpanded,
                    )}
                    onClick={toggleCourseModalPrerequisites}
                    aria-expanded={prereqExpanded}
                  >
                    Prerequisites
                    <ChevronIcon open={prereqExpanded} />
                  </button>
                )}
                {listing.course.catalogUrl && (
                  <a
                    className={styles.chipLink}
                    href={listing.course.catalogUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Catalog
                    <ExternalIcon />
                  </a>
                )}
              </div>

              {listing.course.prerequisites && prereqExpanded && (
                <div className={styles.prereqPanel}>
                  <div className={styles.prereqPanelInner}>
                    <div className={styles.prereqText}>
                      <span className={styles.prereqLabel}>Prereqs:</span>
                      {listing.course.prerequisites}
                    </div>
                    <button
                      type="button"
                      className={styles.prereqClose}
                      onClick={() => setCourseModalPrerequisitesExpanded(false)}
                      aria-label="Collapse prerequisites"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.scheduleHeader}>
                <div className={styles.scheduleHeading}>
                  <div className={styles.scheduleTitle}>Schedule Options</div>
                  {isFall2026 && (
                    <span className={styles.sectionMappingTrigger}>
                      <button
                        type="button"
                        className={styles.sectionMappingButton}
                        aria-label="View TSS sections"
                        aria-describedby={sectionMappingTooltipId}
                        onClick={() => {
                          bodyRef.current?.scrollTo({ top: 0 });
                          setView('section-mapping');
                        }}
                      >
                        <SectionMappingIcon />
                      </button>
                      <span
                        id={sectionMappingTooltipId}
                        className={styles.sectionMappingTooltip}
                        role="tooltip"
                      >
                        View Section Mapping for the TSS sections used for
                        enrollment.
                      </span>
                    </span>
                  )}
                </div>
                <div className={styles.scheduleCount}>
                  {modalCourse.groups.length} offering{' '}
                  {modalCourse.groups.length === 1 ? 'group' : 'groups'}
                </div>
              </div>

              {modalCourse.groups.length === 0 ? (
                <div className={styles.emptyState}>
                  Schedule details are unavailable for this course.
                </div>
              ) : (
                modalCourse.groups.map((group) => {
                  const [target] = group.sections;
                  const mappingEntry = target
                    ? modalCourse.sectionMapping.bySectionId.get(
                        target.sectionId,
                      )
                    : undefined;
                  return (
                    <OfferingGroupCard
                      key={group.familyPrefix}
                      model={{
                        group,
                        active: activeFamily === group.familyPrefix,
                        canEditWorksheet,
                        mappingEntry,
                        inWorksheet: Boolean(
                          mappingEntry &&
                          target &&
                          worksheetHasListing(target.listing),
                        ),
                        selectedCode: selectedSections[group.familyPrefix],
                        updatedLabel,
                        worksheetDisabled,
                      }}
                      actions={{
                        onSelect: handleSelectSection,
                        onAdd: handleAdd,
                        onToggleWorksheet: handleToggleWorksheet,
                        setRef(node) {
                          cardRefs.current[group.familyPrefix] = node;
                        },
                      }}
                    />
                  );
                })
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
