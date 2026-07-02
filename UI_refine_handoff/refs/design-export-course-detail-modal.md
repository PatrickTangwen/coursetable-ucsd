# UCSD Course Planner — Course Detail Modal Component Reference for Redesign

This document contains all key component code for the UCSD Snapshot Course Detail Modal.
The modal displays course information (title, term, description, units, prerequisites),
schedule options grouped by offering families, and individual meeting rows with seat
availability. Users can select sections and add them to their worksheet.

**Tech stack**: React 19, TypeScript, Zustand (state), CSS Modules (no CSS vars — hard-coded colors), react-helmet (SEO), clsx (classnames), sonner (toasts)

---

## Page Layout Overview

The modal is a centered `<dialog>` overlaying a semi-transparent backdrop. It has two
vertical zones:

1. **Header** (sticky, non-scrolling): course title + term + code, optional section
   pills (when multiple offering groups), tab bar (Overview / Past Grades) + toolbar
   icons (+, share, more), and a thin separator line.
2. **Body** (scrollable): course description, info chips (Units, Division, Prerequisites,
   Catalog), and a list of `OfferingGroupCard` components — each containing meeting rows
   and an "Add to Worksheet" button.

The modal is max 780px wide, max 860px tall, with 14px border-radius. On mobile
(≤720px) it nearly fills the screen. The offering group cards use CSS container queries
for responsive grid layout.

---

## 1. Modal Container & Header: `UcsdSnapshotCourseModal.tsx`

The main modal component. Contains all sub-components inline (no separate file imports
for cards/rows). Manages focus trapping, keyboard navigation (Escape to close, Tab
cycling), and body scroll lock.

```tsx
// frontend/src/components/CourseModal/UcsdSnapshotCourseModal.tsx

// === Icon components (inline SVGs) ===

function CloseIcon({ size = 20 }) {
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

function PlusIcon({ size = 18 }) {
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

function ChevronIcon({ open }) {
  return (
    <svg
      className={clsx(styles.chipChevron, open && styles.chipChevronExpanded)}
      width="10"
      height="10"
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

// === Day-of-week dots ===

function ModalDayDots({ rawDays, allowWeekend = false }) {
  const days = parseDays(rawDays ?? '');
  // Shows 5 day circles (M Tu W Th F), shifts window for weekend-only meetings
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

// === Meeting Row ===

function MeetingRow({ row, group, selected, updatedLabel, onSelect }) {
  const code = ucsdMeetingTypeCode(row.meeting.meeting_type);
  const availability =
    row.role !== 'info' && row.section
      ? formatUcsdAvailability(
          row.section.enrolled,
          row.section.capacity,
          row.section.waitlist_count,
        )
      : null;
  const meetingTime = formatTime(row.meeting.start_time, row.meeting.end_time);
  const examDate =
    row.role === 'info' ? formatExamRowDate(row.meeting.date) : null;

  const rowClassName = clsx(
    styles.meetingRow,
    row.role === 'anchor' && styles.anchorRow,
    row.role === 'selectable' && styles.selectableRow,
    row.role === 'info' && styles.infoRow,
    selected && styles.selectedRow,
  );

  const content = (
    <>
      <div className={styles.radioSlot}>
        {row.role === 'selectable' && row.section && (
          <input
            type="radio"
            className={styles.radio}
            name={`course-modal-${group.familyPrefix}`}
            checked={selected}
            onChange={() => onSelect(row.section)}
            aria-label={`Select ${row.sectionCode}`}
          />
        )}
      </div>
      <div className={styles.typeCell}>
        <span
          className={clsx(
            styles.typeBadge,
            typeClass[code] ?? styles.typeInstruction,
          )}
        >
          {code}
        </span>
        <span className={styles.typeLabel}>
          {ucsdMeetingTypeLabel(row.meeting.meeting_type)}
        </span>
      </div>
      <div className={styles.sectionCode}>{row.sectionCode}</div>
      <div className={styles.meetingTime}>
        {!row.meeting.is_tba && (
          <ModalDayDots
            rawDays={row.meeting.raw_days}
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

// === Offering Group Card ===

function OfferingGroupCard({
  group,
  active,
  selectedCode,
  updatedLabel,
  onSelect,
  onAdd,
  setRef,
}) {
  const rows = buildMeetingRows(group);
  const selectedSection =
    group.sections.length === 1
      ? group.sections[0]
      : selectedSectionForGroup(group, selectedCode);

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
              row.section?.section_code === selectedCode
            }
            updatedLabel={updatedLabel}
            onSelect={(section) => onSelect(group, section)}
          />
        </div>
      ))}

      {selectedSection ? (
        <div className={styles.cardAction}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onAdd(selectedSection.listing)}
          >
            <PlusIcon size={14} />
            Add {selectedSection.section_code ?? group.familyPrefix} to
            Worksheet
          </button>
        </div>
      ) : (
        <div className={styles.noSelection}>
          Select a{' '}
          {ucsdMeetingTypeLabel(
            rows.find((r) => r.role === 'selectable')?.meeting.meeting_type,
          ).toLowerCase()}{' '}
          section to add this group
        </div>
      )}
    </div>
  );
}

// === Main Modal Component ===

export default function UcsdSnapshotCourseModal({
  listing,
  archive,
  view,
  setView,
  title,
  description,
  structuredJSON,
}) {
  const titleId = useId();
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const cardRefs = useRef({});
  const { closeModal } = useModalHistory();

  // Zustand store fields: activeFamilyState, selectedSections, prereqExpanded,
  // resetCourseModalUI, setCourseModalActiveFamily, selectCourseModalSection,
  // toggleCourseModalPrerequisites, setCourseModalPrerequisitesExpanded,
  // addAnonymousWorksheetListing, addActiveSavedWorksheetListing, authStatus

  // Effects: reset UI state on listing change, lock body scroll, trap focus + Escape key

  const units = unitsLabel(archive, listing);
  const level = courseLevelLabel(listingCourseNumber(listing));
  const hasRestrictions = Boolean(archive?.restrictions_text);
  const updatedLabel = formatSnapshotUpdatedLabel(snapshotGeneratedAt(listing));

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
        {/* --- HEADER --- */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              <div id={titleId} className={styles.title}>
                {listing.course.title}{' '}
                <span className={styles.term}>
                  ({toSeasonString(listing.course.season_code)})
                </span>
              </div>
              <div className={styles.courseCode}>{listing.course_code}</div>
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

          {/* Section pills (only when multiple offering groups) */}
          {modalCourse.groups.length > 1 && (
            <div className={styles.sectionPills}>
              {modalCourse.groups.map((group) => (
                <button
                  key={group.familyPrefix}
                  type="button"
                  className={clsx(
                    styles.sectionPill,
                    activeFamily === group.familyPrefix &&
                      styles.sectionPillActive,
                  )}
                  onClick={() => handleSelectPill(group.familyPrefix)}
                  aria-pressed={activeFamily === group.familyPrefix}
                >
                  <span>{sectionLabel(group)}</span>
                  <span className={styles.pillInstructor}>
                    {groupInstructor(group)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div
            className={clsx(
              styles.controls,
              modalCourse.groups.length > 1 && styles.controlsWithPills,
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
            </div>
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
                disabled={!archive?.catalog_url}
                onClick={() => {
                  if (archive?.catalog_url)
                    window.open(archive.catalog_url, '_blank', 'noreferrer');
                }}
                aria-label="Open UCSD catalog"
              >
                <MoreIcon />
              </button>
            </div>
          </div>
          <div className={styles.separator} />
        </div>

        {/* --- BODY --- */}
        <div className={styles.body}>
          {currentView === 'past-grades' ? (
            <UcsdSnapshotPastGrades archive={archive} />
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
                {archive?.prerequisites_text && (
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
                {archive?.catalog_url && (
                  <a
                    className={styles.chipLink}
                    href={archive.catalog_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Catalog <ExternalIcon />
                  </a>
                )}
              </div>

              {archive?.prerequisites_text && prereqExpanded && (
                <div className={styles.prereqPanel}>
                  <div className={styles.prereqPanelInner}>
                    <div className={styles.prereqText}>
                      <span className={styles.prereqLabel}>Prereqs:</span>
                      {archive.prerequisites_text}
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
```

### Modal CSS (`UcsdSnapshotCourseModal.module.css`)

```css
/* frontend/src/components/CourseModal/UcsdSnapshotCourseModal.module.css */

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 42%);
  animation: backdrop-fade-in 0.2s ease-out;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    sans-serif;
}

.modal {
  position: relative;
  z-index: 1;
  width: calc(100% - 56px);
  max-width: 780px;
  height: calc(100% - 56px);
  max-height: 860px;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  background: #fff;
  border-radius: 14px;
  color: inherit;
  box-shadow:
    0 24px 80px rgb(0 0 0 / 18%),
    0 4px 16px rgb(0 0 0 / 8%);
  animation: modal-fade-in 0.25s ease-out;
}

.backdropButton {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: default;
}

.header {
  flex-shrink: 0;
  padding: 24px 28px 0;
}

.titleRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.titleBlock {
  min-width: 0;
  flex: 1;
}

.title {
  color: #1a1a2e;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.35;
}

.term {
  color: #8b8fa3;
  font-weight: 400;
}

.courseCode {
  margin-top: 5px;
  color: #9a9db4;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.closeButton,
.iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #1a56db;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.closeButton {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  color: #9a9db4;
}
.closeButton:hover,
.closeButton:focus-visible {
  background: #f0f0f5;
  color: #5a5d7a;
}

/* --- Section Pills (multi-group selector) --- */

.sectionPills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  max-height: min(144px, 24vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 4px 2px 0;
  scrollbar-gutter: stable;
}

.sectionPill {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid #dde3f0;
  border-radius: 6px;
  background: #fff;
  color: #4a4d68;
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.sectionPill:hover,
.sectionPill:focus-visible {
  background: #f4f6fa;
}
.sectionPillActive {
  border-color: #1a56db;
  background: #1a56db;
  color: #fff;
}
.sectionPillActive:hover,
.sectionPillActive:focus-visible {
  background: #1a56db;
  color: #fff;
}
.pillInstructor {
  max-width: 130px;
  overflow: hidden;
  color: #9a9db4;
  font-size: 10.5px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sectionPillActive .pillInstructor {
  color: rgb(255 255 255 / 70%);
}

/* --- Controls (tabs + toolbar) --- */

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}
.controlsWithPills {
  margin-top: 14px;
}

.tabs,
.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab {
  padding: 7px 16px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4a4d68;
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  transition: background 0.15s ease;
}
.tab:hover,
.tab:focus-visible {
  background: #f4f4f8;
}
.tabActive {
  background: #e8f0fe;
  color: #1a56db;
  font-weight: 600;
}

.iconButton {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}
.iconButton:hover,
.iconButton:focus-visible {
  background: #e8f0fe;
}
.iconButton:disabled {
  color: #b6bdd0;
  cursor: not-allowed;
}

.separator {
  height: 1px;
  margin-top: 12px;
  background: #e8e9ef;
}

/* --- Body --- */

.body {
  flex: 1;
  padding: 22px 28px 32px;
  overflow-y: auto;
}

.description {
  margin: 0 0 14px;
  color: #4a4d68;
  font-size: 14.5px;
  line-height: 1.65;
  text-wrap: pretty;
}

/* --- Info Chips --- */

.chip,
.chipButton,
.chipLink {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  text-decoration: none;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.unitsChip {
  background: #eef2ff;
  color: #3b52a8;
  font-weight: 600;
}
.levelChip,
.restrictionChip {
  background: #fff1f2;
  color: #be123c;
  font-weight: 500;
}
.chipButton {
  background: #f5f3ff;
  color: #6d28d9;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s ease;
  user-select: none;
}
.chipButton:hover,
.chipButton:focus-visible,
.chipButtonExpanded {
  background: #ede9fe;
}
.chipChevron {
  transition: transform 0.2s ease;
}
.chipChevronExpanded {
  transform: rotate(180deg);
}
.chipLink {
  background: #f0f9ff;
  color: #1a56db;
  font-weight: 500;
  transition: background 0.15s ease;
}
.chipLink:hover,
.chipLink:focus-visible {
  background: #dbeafe;
}

/* --- Prerequisites Panel --- */

.prereqPanel {
  margin-bottom: 8px;
  padding: 11px 14px;
  border: 1px solid #e9e5f5;
  border-radius: 8px;
  background: #faf8ff;
}
.prereqPanelInner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.prereqText {
  color: #33354d;
  font-size: 13px;
  line-height: 1.55;
  text-wrap: pretty;
}
.prereqLabel {
  margin-right: 6px;
  color: #6d28d9;
  font-weight: 600;
}
.prereqClose {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 2px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #8b8fa3;
  cursor: pointer;
  transition: color 0.15s ease;
}
.prereqClose:hover,
.prereqClose:focus-visible {
  color: #6d28d9;
}

/* --- Schedule Options Header --- */

.scheduleHeader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  margin-bottom: 14px;
}
.scheduleTitle {
  color: #1a1a2e;
  font-size: 15px;
  font-weight: 700;
}
.scheduleCount {
  color: #8b8fa3;
  font-size: 12.5px;
}

/* --- Offering Group Card --- */

.card {
  container-type: inline-size;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid #e2e4ea;
  border-radius: 10px;
  background: #fff;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}
.cardActive {
  border-color: #bfdbfe;
  background: #fafbff;
}

.cardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid #e2e4ea;
  background: transparent;
}
.cardTitle {
  color: #1a1a2e;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}
.cardSubTitle {
  margin-top: 2px;
  color: #5a5d7a;
  font-size: 13px;
  font-weight: 600;
}
.cardInstructor {
  color: #5a5d7a;
  font-size: 13px;
  font-weight: 500;
  text-align: right;
}

/* --- Meeting Row (grid layout) --- */

.meetingRow {
  display: grid;
  grid-template-columns:
    20px minmax(96px, max-content) 44px minmax(253px, 1fr)
    minmax(20px, 0.65fr) minmax(88px, max-content) minmax(20px, 0.65fr)
    max-content;
  align-items: center;
  gap: 4px 8px;
  padding: 9px 18px;
  border-bottom: 1px solid #f3f4f7;
  border-left: 3px solid transparent;
  background: transparent;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}
.anchorRow {
  background: #f8fafd;
}
.selectableRow {
  cursor: pointer;
}
.selectableRow:hover,
.selectableRow:focus-within {
  background: #eef4ff;
}
.selectedRow,
.selectedRow:hover,
.selectedRow:focus-within {
  border-left-color: #1a56db;
  background: #edf4ff;
}
.infoRow {
  background: transparent;
}

.rowSeparator {
  padding: 10px 18px 5px 54px;
  border-top: 1px solid #eeeff3;
  color: #8b8fa3;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.radioSlot {
  grid-column: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #1a56db;
  cursor: pointer;
}

/* --- Meeting Row Cells --- */

.typeCell {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 5px;
}

.typeBadge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.5;
}
.typeLE {
  background: #dbeafe;
  color: #1e40af;
}
.typeDI {
  background: #dcfce7;
  color: #166534;
}
.typeLA {
  background: #ede9fe;
  color: #5b21b6;
}
.typeFI {
  background: #fcebeb;
  color: #791f1f;
}
.typeMI {
  background: #fef9c3;
  color: #854d0e;
}
.typeRE {
  background: #f3f4f6;
  color: #4b5563;
}
.typeActivity {
  background: #fce7f3;
  color: #9d174d;
}
.typeInstruction {
  background: #e0f2fe;
  color: #075985;
}
.typeInfo {
  background: #f0f0f2;
  color: #777;
}
.typeLabel {
  color: #8b8fa3;
  font-size: 12px;
  font-weight: 500;
}

.sectionCode {
  grid-column: 3;
  color: #33354d;
  font-size: 13px;
  font-weight: 600;
}

.meetingTime {
  grid-column: 4;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.dayDots {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}
.dayDot {
  width: 22px;
  height: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1;
}
.dayDotActive {
  background: #334155;
  color: #fff;
}
.dayDotInactive {
  background: #f0f1f5;
  color: #c5c8d6;
}

.timeText {
  color: #33354d;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.location {
  grid-column: 6;
  color: #5a5d7a;
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

/* --- Seat Availability --- */

.availability {
  grid-column: 8;
  justify-self: end;
  min-width: 70px;
  color: #9a9db4;
  font-size: 11.5px;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
.availabilityCritical,
.availabilityFull {
  color: #e24b4a;
}
.availabilityLow {
  color: #d85a30;
}
.availabilityMedium {
  color: #eda100;
}
.availabilityHigh {
  color: #1d9e75;
}
.availabilityAvailable {
  color: #639922;
}
.availabilityDetail {
  display: block;
  margin-top: 1px;
  color: #9a9db4;
  font-size: 10.5px;
  font-weight: 500;
}
.updatedLabel {
  display: block;
  margin-top: 1px;
  color: #b0b3c4;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.3;
}
.examDate {
  color: #5a5d7a;
}

/* --- Add to Worksheet Button --- */

.cardAction {
  padding: 14px 18px;
  border-top: 1px solid #eeeff3;
  background: #fafbff;
}
.addButton {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 16px;
  border: 0;
  border-radius: 8px;
  background: #1a56db;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  transition: background 0.15s ease;
}
.addButton:hover,
.addButton:focus-visible {
  background: #1548b8;
}
.noSelection {
  padding: 12px 18px;
  border-top: 1px solid #f3f4f7;
  color: #9a9db4;
  font-size: 12.5px;
  text-align: center;
}
.emptyState {
  padding: 18px;
  border: 1px solid #e2e4ea;
  border-radius: 10px;
  color: #8b8fa3;
  font-size: 13px;
  text-align: center;
}

/* --- Animations --- */

@keyframes modal-fade-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes backdrop-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .backdrop,
  .modal {
    animation: none;
  }
}

/* --- Responsive: Container Query (card-level) --- */

@container (max-width: 700px) {
  .meetingRow {
    grid-template-columns:
      20px minmax(96px, max-content) 44px minmax(0, 1fr)
      minmax(70px, max-content);
    align-items: start;
    row-gap: 6px;
  }
  .meetingTime {
    grid-column: 4;
  }
  .location {
    grid-column: 4;
    grid-row: 2;
  }
  .availability {
    grid-column: 5;
    grid-row: 1 / span 2;
    align-self: start;
  }
}

/* --- Responsive: Screen Width --- */

@media (max-width: 720px) {
  .modal {
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    border-radius: 12px;
  }
  .header {
    padding: 14px 14px 0;
  }
  .title {
    font-size: 19px;
    line-height: 1.25;
  }
  .courseCode {
    margin-top: 4px;
    font-size: 14px;
  }
  .closeButton {
    width: 32px;
    height: 32px;
  }
  .sectionPills {
    margin-top: 10px;
    max-height: min(124px, 22vh);
  }
  .sectionPill {
    min-width: 0;
    padding: 5px 10px;
  }
  .pillInstructor {
    max-width: 108px;
  }
  .controls,
  .controlsWithPills {
    margin-top: 12px;
    gap: 8px;
  }
  .tabs,
  .toolbar {
    gap: 4px;
  }
  .tab {
    padding: 6px 10px;
    border-radius: 7px;
    font-size: 12.5px;
  }
  .iconButton {
    width: 30px;
    height: 30px;
  }
  .separator {
    margin-top: 10px;
  }
  .body {
    padding: 14px;
  }
  .meetingRow {
    grid-template-columns: 20px minmax(0, 1fr) 44px;
    align-items: flex-start;
    row-gap: 7px;
  }
  .typeCell {
    grid-column: 2;
  }
  .sectionCode {
    grid-column: 3;
  }
  .meetingTime {
    grid-column: 2 / -1;
    flex-direction: column;
    gap: 6px;
  }
  .location {
    grid-column: 2 / -1;
  }
  .availability {
    grid-column: 2 / -1;
    text-align: left;
  }
}

@media (max-width: 400px) {
  .header {
    padding: 12px 12px 0;
  }
  .title {
    font-size: 18px;
  }
  .body {
    padding: 12px;
  }
  .tab {
    padding: 5px 8px;
    font-size: 12px;
  }
  .iconButton {
    width: 28px;
    height: 28px;
  }
}
```

---

## 2. Meeting Type Codes: `ucsdMeetingTypes.ts`

Maps UCSD meeting type strings to two-letter codes and human-readable labels.
Used by the type badge and row separator labels.

```ts
// frontend/src/components/CourseModal/ucsdMeetingTypes.ts

const UCSD_MEETING_TYPES = {
  AC: 'Activity',
  CL: 'Clinical Clerkship',
  CO: 'Conference',
  DI: 'Discussion',
  FI: 'Final Exam',
  FM: 'Film',
  FW: 'Fieldwork',
  IN: 'Independent Study',
  IT: 'Internship',
  LA: 'Laboratory',
  LE: 'Lecture',
  MI: 'Midterm',
  MU: 'Make-up Session',
  OT: 'Other Additional Meeting',
  PB: 'Problem Session',
  PR: 'Practicum',
  RE: 'Review Session',
  SE: 'Seminar',
  ST: 'Studio',
  TU: 'Tutorial',
} as const;

// ucsdMeetingTypeCode(meetingType) → two-letter code (e.g. "LE", "FI")
// ucsdMeetingTypeLabel(meetingType) → full label (e.g. "Lecture", "Final Exam")
// isUcsdInfoMeeting(meetingType) → true for FI, MI, RE (info-only rows)
```

---

## 3. Modal Data Layer: `ucsdSnapshotModalData.ts`

Transforms raw listing data into the modal's view model: groups sections by
family prefix, computes shared meetings, and formats availability text.

```ts
// frontend/src/components/CourseModal/ucsdSnapshotModalData.ts

export type UcsdModalListing =
  | CatalogListing
  | CourseModalPrefetchListingDataFragment;

export type UcsdModalSection = OfferingGroup['sections'][number] & {
  listing: UcsdModalListing;
};

export type UcsdModalOfferingGroup = Omit<OfferingGroup, 'sections'> & {
  sections: UcsdModalSection[];
};

export type UcsdSnapshotModalCourse = {
  listings: UcsdModalListing[];
  groups: UcsdModalOfferingGroup[];
  activeFamily: string; // e.g. "A"
  selectedSectionCode: string | null; // e.g. "A00"
};

export type UcsdAvailabilityDisplay = {
  main: string; // "21 seats left" or "FULL · WL(3)"
  detail: string; // additional detail (currently empty)
  status: 'critical' | 'low' | 'medium' | 'high' | 'available' | 'full';
};

// buildUcsdSnapshotModalCourse(listing, allListings) → UcsdSnapshotModalCourse
// formatUcsdAvailability(enrolled, capacity, waitlistCount) → UcsdAvailabilityDisplay
// formatSnapshotUpdatedLabel(generatedAt) → "Updated today" | "Updated 1 day ago" | null
// getSectionVaryingMeetings(section, group) → meetings unique to this section
```

---

## 4. Course Modal UI State: `CourseModalUISlice.ts`

Zustand slice managing transient UI state for the open modal.

```ts
// frontend/src/slices/CourseModalUISlice.ts

export interface CourseModalUISliceState {
  courseModalActiveFamily: string | null; // currently focused offering group
  courseModalSelectedSections: { [family: string]: string | null }; // section selection per family
  courseModalPrerequisitesExpanded: boolean; // prerequisites chip expanded?
}

export interface CourseModalUISliceActions {
  resetCourseModalUI: (activeFamily, selectedSections?) => void;
  setCourseModalActiveFamily: (family) => void;
  selectCourseModalSection: (family, sectionCode) => void;
  toggleCourseModalPrerequisites: () => void;
  setCourseModalPrerequisitesExpanded: (expanded) => void;
}
```

---

## 5. Utility Functions

### Day Parsing & Time Formatting (`catalogView.ts`)

```ts
// frontend/src/utilities/catalogView.ts

export type DayFlags = {
  M: boolean;
  Tu: boolean;
  W: boolean;
  Th: boolean;
  F: boolean;
  Sa: boolean;
  Su: boolean;
};

// parseDays("MWF") → { M: true, Tu: false, W: true, Th: false, F: true, Sa: false, Su: false }
export function parseDays(raw: string): DayFlags {
  /* parser handles M, Tu, W, Th, F, Sa, Su */
}

// formatTime("08:00", "10:50") → "8:00 – 10:50 AM"
export function formatTime(start, end): string {
  /* 24h → 12h with shared AM/PM */
}

export type SeatsStatus = 'critical' | 'low' | 'medium' | 'high' | 'available';
// seatsColor(enrolled, capacity) → SeatsStatus based on % remaining:
//   <25% → critical, <50% → low, <75% → medium, <90% → high, else → available
```

### Offering Groups (`catalogView.ts`)

```ts
export type OfferingGroup = {
  familyPrefix: string; // "A", "B", etc.
  sections: SectionInput[];
  sharedMeetings: Meeting[]; // meetings identical across all sections in group
  totalEnrolled: number;
  totalCapacity: number;
};

// buildOfferingGroups(sections) → groups sections by first letter of section_code
```

### Season Formatting (`course.ts`)

```ts
// toSeasonString("s126") → "Summer Session 1 2026"
// toSeasonString("fa25") → "Fall 2025"
export function toSeasonString(seasonCode): string;
```

---

## Data Model Summary

A `UcsdModalListing` is a course listing (one CRN) containing:

- `crn: number` — unique section identifier
- `course_code: string` — e.g. "ANAR 144"
- `course.title: string` — e.g. "Pharaohs, Mummies, and Pyramids..."
- `course.season_code: string` — e.g. "s126" (Summer Session 1 2026)
- `course.description: string | null`
- `course.section: string` — e.g. "A00"
- `course.same_course_id: number`
- `course.course_professors: { professor: { name: string } }[]`
- `course.course_meetings: { start_time, end_time, days_of_week, location }[]`
- `course.ucsd_calendar: UcsdCalendarDetails | null` — UCSD-specific schedule data

A `UcsdCourseArchive` (from UCSD catalog enrichment) contains:

- `units: string | null` — e.g. "4"
- `prerequisites_text: string | null`
- `restrictions_text: string | null`
- `catalog_url: string | null`
- `grade_archive_records: GradeArchiveRecord[]` — historical grades by term/instructor

A `GradeArchiveRecord` contains:

- `year, quarter, instructor: string`
- `gpa, a, b, c, d, f, w, p, np: number | null` — grade distribution percentages

A `UcsdCalendarDetails` (per-section schedule data) contains:

- `section_id, section_code: string`
- `meeting_type: string | null` — e.g. "Lecture", "Final Exam"
- `meetings: { days, date, start_time, end_time, building, room, is_tba, meeting_type, raw_days, raw_location }[]`
- `enrolled, capacity: number | null`
- `waitlist_count: number`

---

## Design Tokens (CSS Variables)

This modal does NOT use CSS custom properties — all colors are hard-coded hex values.
Here is the effective color palette:

**Brand / Primary**

- `#1a56db` — primary blue (buttons, active tab, selected row border, icon buttons, links)
- `#1548b8` — primary blue hover
- `#e8f0fe` — primary blue tint (active tab background, icon hover)
- `#bfdbfe` — active card border

**Text**

- `#1a1a2e` — heading text (title, section title, schedule title)
- `#33354d` — body text (section code, time)
- `#4a4d68` — secondary text (description, tabs)
- `#5a5d7a` — tertiary text (subtitle, instructor, location)
- `#8b8fa3` — muted text (term, type label, schedule count, separator)
- `#9a9db4` — quiet text (course code, availability, updated label)
- `#b0b3c4` — faintest text (updated label)

**Backgrounds**

- `#fff` — modal, card, pill
- `#fafbff` — active card, card action area
- `#f8fafd` — anchor row
- `#edf4ff` / `#eef4ff` — selected row / hover selectable row
- `#f4f4f8` — tab hover
- `#f4f6fa` — pill hover
- `#f0f0f5` — close button hover

**Borders**

- `#e2e4ea` — card border
- `#e8e9ef` — separator
- `#eeeff3` — row separator, card action border
- `#f3f4f7` — meeting row bottom border
- `#dde3f0` — pill border

**Chip colors (by type)**

- Units: bg `#eef2ff`, text `#3b52a8`
- Level/Restrictions: bg `#fff1f2`, text `#be123c`
- Prerequisites: bg `#f5f3ff` / `#ede9fe`, text `#6d28d9`
- Catalog link: bg `#f0f9ff` / `#dbeafe`, text `#1a56db`

**Meeting type badge colors**

- LE (Lecture): bg `#dbeafe`, text `#1e40af`
- DI (Discussion): bg `#dcfce7`, text `#166534`
- LA (Laboratory): bg `#ede9fe`, text `#5b21b6`
- FI (Final Exam): bg `#fcebeb`, text `#791f1f`
- MI (Midterm): bg `#fef9c3`, text `#854d0e`
- RE (Review): bg `#f3f4f6`, text `#4b5563`
- Activity: bg `#fce7f3`, text `#9d174d`
- Default instruction: bg `#e0f2fe`, text `#075985`

**Day dot colors**

- Active: bg `#334155`, text `#fff`
- Inactive: bg `#f0f1f5`, text `#c5c8d6`

**Seat availability colors**

- Critical / Full: `#e24b4a`
- Low: `#d85a30`
- Medium: `#eda100`
- High: `#1d9e75`
- Available: `#639922`

**Shadows**

- Modal: `0 24px 80px rgb(0 0 0 / 18%), 0 4px 16px rgb(0 0 0 / 8%)`

---

## Interaction Patterns

- **Modal open/close**: Fade-in animation (0.25s scale + opacity). Close via X button, backdrop click, or Escape key. Body scroll is locked while open.
- **Focus trap**: Tab cycling constrained within the modal. Close button receives initial focus.
- **Tab switching**: Overview / Past Grades tabs. Active tab gets blue background + bold text.
- **Section pills** (multi-group): Shown only when course has multiple offering groups. Active pill is solid blue. Clicking scrolls the corresponding card into view.
- **Prerequisites expand/collapse**: Chip button with rotating chevron. Expands to show a purple-tinted panel below chips. Can be closed via X in the panel.
- **Section selection**: Radio buttons for selectable meeting rows (e.g., choosing a discussion section). Selected row gets blue left border + blue background tint.
- **Hover states**: Selectable rows highlight on hover (`#eef4ff`). Tabs, icon buttons, pills, and chips all have subtle background transitions (0.15s ease).
- **Add to Worksheet**: Full-width blue button at card bottom. Shows section code dynamically. Triggers a toast notification on success. Works for both authenticated (saved worksheet) and anonymous users.
- **Copy URL**: Copies current URL to clipboard via navigator.clipboard API, shows toast.
- **More button**: Opens UCSD catalog URL in new tab. Disabled when no catalog URL available.
- **Responsive layout**: Meeting row grid collapses from 8-column desktop layout → 5-column tablet → 3-column mobile. Modal padding reduces. Container queries handle card-level responsiveness independently of viewport.
