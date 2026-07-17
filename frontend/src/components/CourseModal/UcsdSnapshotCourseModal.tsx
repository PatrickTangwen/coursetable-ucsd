import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  type UcsdModalListing,
  type UcsdModalOfferingGroup,
  type UcsdModalSection,
} from './ucsdSnapshotModalData';
import { useFerry } from '../../hooks/useFerry';
import { useModalHistory } from '../../hooks/useModalHistory';
import type { CoursePlanningCourse } from '../../queries/coursePlanningViewModels';
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

type UcsdModalView = 'overview' | 'evals' | 'past-grades';

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

function CopyUrlButton() {
  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success('Course URL copied'),
      () => toast.error('Failed to copy course URL'),
    );
  };

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={copyUrl}
      aria-label="Copy course URL"
    >
      <ShareIcon />
    </button>
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

function sectionLabel(group: UcsdModalOfferingGroup): string {
  return group.familyPrefix ? `Section ${group.familyPrefix}` : 'Section';
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
};

function buildMeetingRows(group: UcsdModalOfferingGroup): MeetingRowData[] {
  const rows: MeetingRowData[] = group.sharedMeetings.map((meeting, index) => ({
    key: `${group.familyPrefix}-shared-${index}`,
    role: isUcsdInfoMeeting(meeting.meetingType) ? 'info' : 'anchor',
    meeting,
    section: null,
    sectionCode: anchorSectionCode(group),
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
        sectionCode: section.sectionCode ?? group.familyPrefix,
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
        )
      : null;
  const meetingTime = formatTime(row.meeting.startTime, row.meeting.endTime);
  const rowClassName = clsx(
    styles.meetingRow,
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
      <div className={styles.sectionCode}>{row.sectionCode}</div>
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

function OfferingGroupCard({
  group,
  active,
  selectedCode,
  updatedLabel,
  onSelect,
  onAdd,
  setRef,
}: {
  readonly group: UcsdModalOfferingGroup;
  readonly active: boolean;
  readonly selectedCode: string | null | undefined;
  readonly updatedLabel: string | null;
  readonly onSelect: (
    targetGroup: UcsdModalOfferingGroup,
    section: UcsdModalSection,
  ) => void;
  readonly onAdd: (listing: UcsdModalListing) => void;
  readonly setRef: (node: HTMLDivElement | null) => void;
}) {
  const rows = buildMeetingRows(group);
  const selectedSection =
    group.sections.length === 1
      ? group.sections[0]
      : selectedSectionForGroup(group, selectedCode);
  const selectedForAdd = selectedSection ?? null;

  return (
    <div
      ref={setRef}
      className={clsx(styles.card, active && styles.cardActive)}
      data-course-modal-family={group.familyPrefix}
    >
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{sectionLabel(group)}</div>
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

      {selectedForAdd ? (
        <div className={styles.cardAction}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onAdd(selectedForAdd.listing)}
          >
            <PlusIcon size={14} />
            Add {selectedForAdd.sectionCode ?? group.familyPrefix} to Worksheet
          </button>
        </div>
      ) : (
        <div className={styles.noSelection}>
          Select a{' '}
          {ucsdMeetingTypeLabel(
            rows.find((row) => row.role === 'selectable')?.meeting.meetingType,
          ).toLowerCase()}{' '}
          section to add this group
        </div>
      )}
    </div>
  );
}

export default function UcsdSnapshotCourseModal({
  listing,
}: {
  readonly listing: UcsdModalListing;
}) {
  const [view, setView] = useState<UcsdModalView>('overview');
  const titleId = useId();
  const modalRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [family: string]: HTMLDivElement | null }>({});
  const sectionSelectButtonRef = useRef<HTMLButtonElement>(null);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const sectionMenuOpenRef = useRef(sectionMenuOpen);
  sectionMenuOpenRef.current = sectionMenuOpen;
  const [scrollTarget, setScrollTarget] = useState<{
    family: string;
    nonce: number;
  } | null>(null);
  const { closeModal } = useModalHistory();
  const { courses } = useFerry();
  const season = listing.section.supportedTerm as Season;
  const allListings = useMemo(
    () => [...(courses[season]?.listings.values() ?? [])],
    [courses, season],
  );
  const modalCourse = useMemo(
    () => buildUcsdSnapshotModalCourse(listing, allListings),
    [allListings, listing],
  );
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
        if (sectionMenuOpenRef.current) {
          setSectionMenuOpen(false);
          sectionSelectButtonRef.current?.focus();
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
  const currentView = view === 'past-grades' ? 'past-grades' : 'overview';
  const updatedLabel = formatSnapshotUpdatedLabel(
    listing.section.availability.snapshotTimestamp ?? listing.generatedAt,
  );
  const units = unitsLabel(listing.course);
  const level = courseLevelLabel(listing.course.courseNumber);
  const hasRestrictions = Boolean(listing.course.restrictions);
  const title = `${listing.course.courseCode} ${listing.section.sectionCode ?? ''}: ${listing.course.title} - UCSD ${toSeasonString(season)} | UCSD Course Planner`;
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

  const closeSectionMenu = () => {
    setSectionMenuOpen(false);
    // The menu unmounts with the focused item in it; return focus to the
    // trigger so Tab order and the dialog's Escape handler keep working.
    sectionSelectButtonRef.current?.focus();
  };

  const handleSelectFamily = (family: string) => {
    setCourseModalActiveFamily(family);
    closeSectionMenu();
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
            if (savedAdded)
              toast.success(`Added ${label} to worksheet`, { duration: 800 });
          },
        );
        return;
      }
      const added = addAnonymousWorksheetListing(target, color);
      if (added)
        toast.success(`Added ${label} to worksheet`, { duration: 800 });
    },
    [addActiveSavedWorksheetListing, addAnonymousWorksheetListing, authStatus],
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

          <div className={styles.controls}>
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
            </div>
            <div className={styles.controlsRight}>
              {modalCourse.groups.length > 1 && (
                <div className={styles.sectionSelect}>
                  <button
                    ref={sectionSelectButtonRef}
                    type="button"
                    className={clsx(
                      styles.sectionSelectButton,
                      sectionMenuOpen && styles.sectionSelectButtonOpen,
                    )}
                    onClick={() => setSectionMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={sectionMenuOpen}
                  >
                    Section {activeFamily}
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
                        onClick={closeSectionMenu}
                        aria-label="Close section menu"
                        tabIndex={-1}
                      />
                      <div className={styles.sectionMenu} role="menu">
                        {modalCourse.groups.map((group) => {
                          const isActive = activeFamily === group.familyPrefix;
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
                                  {sectionLabel(group)}
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
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() =>
                    activeSelected && handleAdd(activeSelected.listing)
                  }
                  aria-label="Add selected section to worksheet"
                >
                  <PlusIcon />
                </button>
                <CopyUrlButton />
                <button
                  type="button"
                  className={styles.iconButton}
                  disabled={!listing.course.catalogUrl}
                  onClick={() => {
                    if (listing.course.catalogUrl) {
                      window.open(
                        listing.course.catalogUrl,
                        '_blank',
                        'noreferrer',
                      );
                    }
                  }}
                  aria-label="Open UCSD catalog"
                >
                  <MoreIcon />
                </button>
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
                <div className={styles.scheduleTitle}>Schedule Options</div>
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
                modalCourse.groups.map((group) => (
                  <OfferingGroupCard
                    key={group.familyPrefix}
                    group={group}
                    active={activeFamily === group.familyPrefix}
                    selectedCode={selectedSections[group.familyPrefix]}
                    updatedLabel={updatedLabel}
                    onSelect={handleSelectSection}
                    onAdd={handleAdd}
                    setRef={(node) => {
                      cardRefs.current[group.familyPrefix] = node;
                    }}
                  />
                ))
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
