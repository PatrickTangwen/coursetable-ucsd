# SunGrid — Worksheet Calendar View Component Reference for Redesign

This document contains all key component code for the Worksheet Calendar View page.
The page displays a weekly calendar view of a student's course schedule at UCSD, with a collapsible stats panel and a course list sidebar. Users can toggle between Calendar and List views, switch terms, manage saved worksheets, hide/show courses, view exam details, and export their schedule.

**Tech stack**: React 19, TypeScript, Zustand (store), React Bootstrap, CSS Modules, react-big-calendar, chroma-js (color manipulation), react-icons

---

## Page Layout Overview

The page is arranged as a **horizontal flex container** with a 1rem gap:

- **Left: Calendar grid** (~75% width, sticky) — a react-big-calendar `work_week` view showing Mon–Fri from the earliest to latest course time. Contains colored event blocks for lectures, discussions, finals.
- **Right: Sidebar** (~25% width) — stacked vertically: a Summary stats panel, then icon buttons (hide/show, settings, export), then a course card list.
- **Top: Navbar** (separate global component) — contains the SunGrid logo, Calendar/List toggle, term selector dropdown, worksheet selector, settings gear, Catalog/Worksheet links, and user avatar.

On mobile (< 768px), the layout switches to a single column.

---

## 1. Navbar Worksheet Controls: `NavbarWorksheetSearch.tsx`

The worksheet-specific controls rendered inside the global navbar. Shows a Calendar/List toggle button group, a term dropdown, and a worksheet selector (for saved worksheet accounts).

```tsx
// frontend/src/components/Worksheet/NavbarWorksheetSearch.tsx

// View toggle (desktop): ToggleButtonGroup with "Calendar" and "List" options
// Term dropdown: uses DropdownMenu component with season options
// Worksheet selector: uses Popout component with SavedWorksheetMenuView

function NavbarWorksheetSearchView({
  isMobile,
  worksheetView,
  changeWorksheetView,
  isExoticWorksheet,
  exitExoticWorksheet,
  hasLegacyWorksheetAccount,
  hasSavedWorksheetAccount,
  activeSavedWorksheet,
  ...otherProps
}) {
  const visibleWorksheetView =
    worksheetView === 'list' ? worksheetView : 'calendar';

  // Mobile: dropdown styled like toggle
  if (isMobile) {
    return (
      <div className={styles.containerMobile}>
        <Dropdown align="end">
          <Dropdown.Toggle className={styles.viewDropdownToggle}>
            <span>{viewLabels[visibleWorksheetView]}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>{/* Calendar / List items */}</Dropdown.Menu>
        </Dropdown>
        {hasSavedWorksheetAccount && <SavedWorksheetHeaderControlsView ... />}
      </div>
    );
  }

  // Desktop: full toggle group + term + worksheet selectors
  return (
    <div className={styles.container}>
      <ToggleButtonGroup
        name="worksheet-view-toggle"
        type="radio"
        value={visibleWorksheetView}
        onChange={changeWorksheetView}
        className={styles.toggleButtonGroup}
      >
        <ToggleButton id="view-toggle-calendar" value="calendar">Calendar</ToggleButton>
        <ToggleButton id="view-toggle-list" value="list">List</ToggleButton>
      </ToggleButtonGroup>

      {isExoticWorksheet ? (
        <div className={styles.exoticWorksheetContainer}>
          <span>Viewing exported worksheet</span>
          <Button variant="primary" onClick={exitExoticWorksheet}>Exit</Button>
        </div>
      ) : hasLegacyWorksheetAccount ? (
        <>
          <SeasonDropdown mobile={false} />
          <WorksheetNumDropdown mobile={false} />
        </>
      ) : hasSavedWorksheetAccount ? (
        <SavedWorksheetHeaderControlsView ... />
      ) : (
        <SeasonDropdown mobile={false} />
      )}
    </div>
  );
}
```

### Navbar Worksheet Controls CSS (`NavbarWorksheetSearch.module.css`)

```css
.container {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.containerMobile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  margin-left: auto;
  margin-right: 0.75rem;
}

.toggleButtonGroup {
  width: 210px;
}

@media (max-width: calc(1200px - 0.5px)) {
  .toggleButtonGroup {
    width: 170px;
  }
}

.toggleButton {
  --bs-btn-active-bg: var(--color-primary);
  --bs-btn-active-border-color: var(--color-primary);
  font-size: 14px;
  background-color: var(--color-surface);
  color: var(--color-text);
  border: var(--color-icon) 2px solid;
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
  padding: 0.25rem 0;
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggleButton:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text);
  border: var(--color-primary-hover) 2px solid;
}

.toggleButton:global(.active) {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

/* Mobile dropdown toggle */
.viewDropdownToggle {
  min-width: 105px;
  padding: 0.25rem 0.65rem;
  font-size: 14px;
  background-color: var(--color-primary) !important;
  border: var(--color-primary) 2px solid !important;
  color: #fff !important;
  border-radius: 0.375rem !important;
}

/* Saved worksheet selector */
.savedWorksheetControls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.savedWorksheetButton {
  min-width: 190px;
  max-width: 240px;
}

.savedWorksheetMenu {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.35rem;
}

.savedWorksheetOptionRow {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-text);
}

.savedWorksheetOptionRow:hover,
.savedWorksheetOptionActive {
  background-color: var(--color-surface-hover);
}

.savedWorksheetOption {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 36px;
  padding: 0.4rem 0.5rem;
  border: 0;
  background: transparent;
  color: var(--color-text);
}

.savedWorksheetStatusText {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.savedWorksheetIconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-text-secondary);
}

.savedWorksheetIconButton:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
}

.createSavedWorksheetButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 34px;
  margin-top: 0.25rem;
  border: 2px solid var(--color-icon);
  border-radius: 0.25rem;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
}

/* Exotic worksheet pill */
.exoticWorksheetContainer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.125rem 0 0.125rem 0.625rem;
  border-radius: 999px;
  border: 1px solid var(--color-icon);
  background-color: var(--color-surface);
}

.exoticWorksheetText {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.exoticExitButton {
  padding: 0.25rem 0.75rem;
  font-size: 14px;
  border-radius: 0 999px 999px 0;
}
```

---

## 2. Page Container: `Worksheet.tsx`

The main page component. Renders the calendar in a `SurfaceComponent` card, a calendar controls cluster (expand/lock/settings), and the sidebar.

```tsx
// frontend/src/pages/Worksheet.tsx

function Worksheet() {
  // Store state: isMobile, worksheetView, isCalendarViewLocked, etc.
  const [expanded, setExpanded] = useState(false);

  const isListView = worksheetView === 'list';
  if (isListView && !isMobile) return <WorksheetList />;

  const LockIcon = isCalendarViewLocked ? FaLock : FaUnlock;
  const FullScreenIcon = expanded ? FaCompressAlt : FaExpandAlt;

  return (
    <div className={styles.container}>
      {/* Mobile dropdowns for non-saved-worksheet accounts */}
      {isMobile && !isExoticWorksheet && !hasSavedWorksheetAccount && (
        <div className={styles.dropdowns}>
          {!isAnonymousWorksheet && <WorksheetNumDropdown mobile />}
          <SeasonDropdown mobile />
        </div>
      )}

      {/* Calendar card */}
      <SurfaceComponent className={styles.calendar}>
        <WorksheetCalendar showWalkingTimes={false} />
        {!isMobile && (
          <div className={styles.calendarControls}>
            {/* Expand/compress trigger with beta dot */}
            <OverlayTrigger placement="top" overlay={<Tooltip>...</Tooltip>}>
              <button
                className={styles.controlsTrigger}
                onClick={() => setExpanded((x) => !x)}
              >
                <FullScreenIcon className={styles.triggerIcon} size={11} />
                <span className={styles.betaIndicator} aria-hidden="true" />
              </button>
            </OverlayTrigger>
            {/* Flyout menu: lock + settings buttons */}
            <div className={styles.controlsMenu}>
              <button
                className={styles.controlBtn}
                onClick={() => setCalendarViewLocked(!isCalendarViewLocked)}
              >
                <LockIcon size={11} />
              </button>
              <button
                className={styles.controlBtn}
                onClick={() => setCalendarLockSettingsOpen(true)}
              >
                <FaCog size={11} />
              </button>
            </div>
          </div>
        )}
      </SurfaceComponent>

      {/* Sidebar (hidden when expanded on desktop) */}
      {(isMobile || !expanded) && (
        <div className={styles.calendarSidebar}>
          <WorksheetStats />
          <WorksheetCalendarList
            highlightBuilding={null}
            showLocation={false}
            showMissingLocationIcon={false}
            controlsMode="full"
            missingBuildingCodes={emptyMissingBuildingCodes}
            hideTooltipContext="calendar"
          />
        </div>
      )}
      <CalendarLockSettingsModal />
    </div>
  );
}
```

### Page Container CSS (`Worksheet.module.css`)

```css
.container {
  --calendar-control-size: 22px;
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

@media (max-width: calc(768px - 0.5px)) {
  .container {
    flex-direction: column;
  }
}

.calendar {
  box-shadow: 0 2px 6px 0 var(--color-shadow);
  border-radius: 8px;
  height: max(calc(100vh - var(--height-navbar) - 2rem), 480px);
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
}

@media (min-width: 768px) {
  .calendar {
    position: sticky;
    top: calc(1rem + 56px);
    min-width: calc(75% - 1rem);
    flex-grow: 1;
  }
}

/* Calendar control cluster: top-right corner, shows on hover */
.calendarControls {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  transform: translate(50%, -40%);
}

.controlsTrigger {
  position: relative;
  width: var(--calendar-control-size);
  height: var(--calendar-control-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: var(--color-bg-button);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: 0;
}

.betaIndicator {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 6px;
  height: 6px;
  background-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.controlsMenu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;
}

.calendarControls:hover .controlsMenu,
.calendarControls:focus-within .controlsMenu {
  opacity: 1;
  visibility: visible;
}

.controlBtn {
  width: var(--calendar-control-size);
  height: var(--calendar-control-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: var(--color-bg-button);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
}

.controlBtn:hover {
  transform: scale(1.1);
  background-color: var(--color-bg-button-hover);
}

.calendarSidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .calendarSidebar {
    max-width: calc(25% - 1rem);
  }
}
```

---

## 3. Calendar Grid: `WorksheetCalendar.tsx`

Wraps react-big-calendar's `<Calendar>` in `work_week` view (Mon–Fri). Dynamically computes the visible time range based on course start/end times. Uses `CalendarEvent` as the custom event component.

```tsx
// frontend/src/components/Worksheet/WorksheetCalendar.tsx

function WorksheetCalendar({ showWalkingTimes = false }) {
  // Store: courses, viewedSeason, isCalendarViewLocked, calendarLockStart/End
  const eventStyleGetter = useEventStyle(); // chroma-js color styling
  const allCourses = useMemo(
    () => getCalendarEvents('rbc', courses, viewedSeason),
    [courses, viewedSeason],
  );

  // Compute earliest/latest hours from course data (default 8am–6pm)
  const { earliest, latest, parsedCourses } = useMemo(() => {
    if (isCalendarViewLocked) {
      // Filter + clamp to lock range
      return { earliest: new Date(0,0,0,calendarLockStart), latest: new Date(0,0,0,calendarLockEnd), ... };
    }
    // Auto-detect range from course times
    ...
  }, [allCourses, isCalendarViewLocked, calendarLockStart, calendarLockEnd]);

  const calendarComponents = useMemo(() => ({
    event: ({ event }) => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CalendarEvent event={event} onWalkModalInteraction={...} />
      </div>
    ),
  }), [...]);

  return (
    <>
      <Calendar
        defaultView="work_week"
        views={['work_week']}
        events={displayEvents}
        min={earliest}
        max={latest}
        localizer={localizer}
        toolbar={false}
        showCurrentTimeIndicator
        selected={selectedEvent}
        onSelectEvent={handleSelectEvent}
        components={calendarComponents}
        eventPropGetter={eventStyleGetter}
        tooltipAccessor={undefined}
      />
      <ColorPickerModal ... />
      <WorksheetMoveModal ... />
    </>
  );
}
```

### React Big Calendar Override CSS (`react-big-calendar-override.css`)

```css
.rbc-time-header-content {
  border-color: var(--color-border);
}
.rbc-header {
  border-bottom: none !important;
}
.rbc-time-header-cell .rbc-header {
  user-select: none;
  cursor: default;
  border-color: var(--color-border);
}
.rbc-time-content {
  border-color: var(--color-border);
  overflow-y: visible !important;
}
.rbc-time-gutter .rbc-timeslot-group {
  user-select: none;
  cursor: default;
  border-color: var(--color-border);
}
.rbc-day-slot .rbc-timeslot-group {
  border-color: var(--color-border);
}
.rbc-day-slot .rbc-time-slot {
  border-color: var(--color-border);
}
.rbc-events-container {
  border: none !important;
  margin: 0 3px !important;
}
.rbc-allday-cell {
  display: none !important;
}
.rbc-today {
  background-color: transparent !important;
}

.rbc-current-time-indicator {
  background-color: var(--color-primary) !important;
  height: 2px !important;
  pointer-events: none;
  box-shadow: 0 0 0.25rem var(--color-shadow);
}

.rbc-current-time-indicator::before {
  content: '';
  position: absolute;
  left: -0.25rem;
  top: 50%;
  width: 0.5rem;
  height: 0.5rem;
  background-color: var(--color-primary);
  border-radius: 50%;
  transform: translateY(-50%);
}

.rbc-time-view {
  border: none !important;
}
.rbc-event {
  overflow: visible !important;
}
.rbc-event:hover {
  box-shadow: inset 0 0 0 1000px rgb(0 0 0 / 15%);
  z-index: 2;
}
.rbc-event-label {
  display: none !important;
}
```

---

## 4. Calendar Event Block: `CalendarEvent.tsx`

Each colored block on the calendar. Shows course code, section suffix, title, location, and "Last updated" date. Adaptively hides lines that don't fit. Uses chroma-js for text color contrast detection. On hover, shows hide/action buttons.

```tsx
// frontend/src/components/Worksheet/CalendarEvent.tsx

function CalendarEventBody({ event, onWalkModalInteraction }) {
  const textColor = chroma.contrast(event.color, 'white') > 2 ? 'white' : 'black';
  const lastMod = event.listing.course.last_updated;

  // Adaptive line hiding: measures available height, hides lines that overflow
  // hideFromLineIndex state tracks which line to start hiding from

  return (
    <div ref={eventRef} className={styles.event} style={{ color: textColor }}>
      {/* Walk badge (if showWalkingTimes is enabled) */}
      {walkBefore && (
        <>
          <span className={styles.walkBadgeDots} style={{...connector styles}} />
          <WalkBadge walk={walkBefore} accentColor={walkColor} ... />
          <WalkDetailsModal walk={walkBefore} show={isWalkModalOpen} ... />
        </>
      )}

      <div ref={eventContentRef} className={styles.eventContent}>
        <strong data-event-line="true" className={clsx(styles.eventLine, styles.courseCodeText)}>
          {formattedTitle}{formatSectionSuffix(event.listing.course)}
        </strong>
        <div data-event-line="true" className={clsx(styles.eventLine, ...)}>
          <span className={styles.courseNameText}>{event.description}</span>
        </div>
        <small data-event-line="true" className={clsx(styles.eventLine, styles.locationText, ...)}>
          {event.location}
        </small>
        {lastMod && (
          <div data-event-line="true" className={clsx(styles.eventLine, ...)}>
            <span className={styles.lastUpdatedText}>
              Last updated: {new Date(lastMod).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Color styling for event blocks
function useEventStyle() {
  const hoverCourse = useStore(state => state.hoverCourse);
  return useCallback((event) => {
    const color = chroma(event.color);
    let backgroundColor = color.alpha(0.85).css();
    let borderColor = color.css();
    // Hover: highlighted course gets saturated, others get dimmed
    if (hoverCourse === event.listing.crn) {
      backgroundColor = color.saturate(1).alpha(0.9).css();
      borderColor = color.saturate(1).css();
    } else if (hoverCourse) {
      backgroundColor = color.alpha(0.3).css();
      borderColor = color.alpha(0.3).css();
    }
    return { style: { backgroundColor, borderColor, borderWidth: '2px' } };
  }, [hoverCourse]);
}

function CalendarEvent({ event }) {
  return (
    <>
      <CalendarEventBody event={event} ... />
      {!isReadonlyWorksheet && (
        <div className={styles.eventButtons}>
          <WorksheetHideButton crn={listing.crn} hidden={false} />
          <WorksheetItemActionsButton event={event} />
        </div>
      )}
    </>
  );
}
```

### Calendar Event CSS (`CalendarEvent.module.css`)

```css
.event {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: visible;
}

.eventContent {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
}

.eventLine {
  width: 100%;
  flex-shrink: 0;
}
.eventLineHidden {
  display: none;
}

.eventButtons {
  display: flex;
  gap: 2px;
  flex-direction: column;
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.eventButtons:hover,
.event:hover ~ .eventButtons {
  opacity: 1;
}

.worksheetHideButton {
  background-color: white !important;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  border: 1px solid #ccc !important;
}

.courseNameText {
  display: block;
  max-width: 100%;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.courseCodeText,
.locationText {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locationText {
  font-weight: 400;
}

.lastUpdatedText {
  display: block;
  max-width: 100%;
  font-size: 12px;
  font-weight: 500;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: calc(768px - 0.5px)) {
  .courseCodeText {
    text-align: left;
    font-size: 12px;
  }
  .event {
    font-size: 12px;
  }
  .courseNameText {
    display: none;
  }
  .locationText {
    display: none;
  }
}

/* Walk badge styles */
.walkBadge {
  position: absolute;
  left: 8px;
  top: var(--walk-badge-top, 0);
  z-index: 4;
  transform: translateY(-100%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 5px 1px 1px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--walk-accent);
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-weight: 500;
  box-shadow:
    0 10px 22px rgb(0 0 0 / 12%),
    0 4px 8px rgb(0 0 0 / 10%);
  cursor: pointer;
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease,
    padding-right 0.18s ease,
    gap 0.18s ease;
}

.walkBadge:hover {
  transform: translateY(calc(-100% - 1px));
  gap: 6px;
  padding-right: 10px;
  box-shadow:
    0 12px 26px rgb(0 0 0 / 16%),
    0 4px 10px rgb(0 0 0 / 14%);
}

.walkBadge:hover .walkBadgeOpen {
  max-width: 40px;
  opacity: 1;
  transform: translateX(0);
}

.walkBadgeIconWrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--walk-accent);
  color: var(--color-text-light);
}

.walkBadgeDots {
  position: absolute;
  left: 4px;
  bottom: calc(100% + var(--walk-connector-offset, 0px));
  z-index: 3;
  height: var(--walk-connector-height, 0);
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    var(--walk-connector) 0,
    var(--walk-connector) 2px,
    transparent 2px,
    transparent 5px
  );
}
```

---

## 5. Summary Stats Panel: `WorksheetStats.tsx`

Collapsible panel showing "Total courses" and "Total credits" with color-coded stat pills. Uses chroma-js color scales (green → yellow → red) based on count thresholds.

```tsx
// frontend/src/components/Worksheet/WorksheetStats.tsx

const courseNumberColormap = chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 6]);
const creditColormap = chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 5.5]);

function StatPill({ colorMap, stat, children }) {
  const theme = useStore(state => state.theme);
  return (
    <dd className={styles.statPill}
      style={{ backgroundColor: colorMap(stat).alpha(theme === 'light' ? 1 : 0.75).css() }}>
      {children}
    </dd>
  );
}

function WorksheetStatsView({ courses, isExoticWorksheet, exoticWorksheet, ... }) {
  const [shown, setShown] = useState(true);
  // Count unique courses (excluding cross-listings, hidden, discussions)
  let courseCnt = 0, credits = 0;
  for (const { listing, hidden } of courses) { ... }

  return (
    <div className={clsx(shown ? 'dropdown' : 'dropup', styles.statsContainer)}>
      <div className={styles.toggleButton}>
        <button className="dropdown-toggle" onClick={() => setShown(!shown)}>
          Summary
        </button>
      </div>
      <Collapse in={shown}>
        <div className={styles.stats}>
          {/* Exotic worksheet info or missing section warnings */}
          <dl>
            <div>
              <dt>Total courses</dt>
              <StatPill colorMap={courseNumberColormap} stat={courseCnt}>{courseCnt}</StatPill>
            </div>
            <div>
              <dt>Total credits</dt>
              <StatPill colorMap={creditColormap} stat={credits}>{credits}</StatPill>
            </div>
          </dl>
        </div>
      </Collapse>
    </div>
  );
}
```

### Stats Panel CSS (`WorksheetStats.module.css`)

```css
.statsContainer {
  background: #a0a0a022;
  border-radius: 8px;
  transition: border-radius 0.3s step-end;
  overflow: hidden;
}

.toggleButton {
  width: 100%;
  padding: 0.5em;
  overflow: hidden;
}

.toggleButton button {
  background: none;
  border: none;
  font-weight: 600;
  color: inherit;
}

.stats {
  padding: 1em 0.5em;
}

.stats dl {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-flow: row wrap;
  gap: 1em;
  align-items: center;
  justify-content: center;
}

.stats dl > div {
  box-shadow: 0 2px 6px 0 var(--color-shadow);
  border-radius: 8px;
  width: 45%;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.stats dt,
.stats dd {
  margin: 0;
  padding: 0.5em;
  font-weight: 600;
  font-size: 14px;
  flex-grow: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex-wrap: wrap;
  transition:
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.stats dt {
  border-radius: 8px 0 0 8px;
}
.stats dd {
  border-radius: 0 8px 8px 0;
}
.stats :is(dt, dd):not(.statPill) {
  background-color: var(--color-surface);
  color: var(--color-text);
}
.statPill {
  color: var(--color-text-dark);
}

.worksheetName {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## 6. Sidebar Controls Row: `WorksheetCalendarList.tsx`

The icon button bar below the stats panel. Contains hide/show-all, settings, and export dropdown buttons. Below it, renders the course card list.

```tsx
// frontend/src/components/Worksheet/WorksheetCalendarList.tsx

function WorksheetCalendarList({
  highlightBuilding, showLocation, showMissingLocationIcon,
  controlsMode, missingBuildingCodes, hideTooltipContext,
}) {
  // Store: courses, viewedSeason, isReadonlyWorksheet, etc.
  const HideShowIcon = areHidden ? BsEyeSlash : BsEye;

  return (
    <div>
      {showControls && (
        <SurfaceComponent elevated className={styles.container}>
          <div className="shadow-sm p-2">
            <ButtonGroup className="w-100">
              {/* Hide/Show All button */}
              {showHideButton && (
                <OverlayTrigger overlay={<Tooltip>{areHidden ? 'Show' : 'Hide'} all</Tooltip>}>
                  <Button variant="none" className={clsx(styles.button, 'px-3 w-100')}>
                    <HideShowIcon className={clsx(styles.icon)} size={32} />
                  </Button>
                </OverlayTrigger>
              )}
              {/* Settings button */}
              {showSettings && (
                <OverlayTrigger overlay={<Tooltip>Worksheet Settings</Tooltip>}>
                  <Button variant="none" className={clsx(styles.button, 'px-3 w-100')}>
                    <CiSettings className={styles.icon} size={32} />
                  </Button>
                </OverlayTrigger>
              )}
              {/* Export dropdown */}
              {showExport && (
                <OverlayTrigger overlay={<Tooltip>Export worksheet calendar</Tooltip>}>
                  <DropdownButton title={<TbCalendarDown size={22} />} variant="none">
                    <Dropdown.Item><ICSExportButton /></Dropdown.Item>
                    <Dropdown.Item><URLExportButton /></Dropdown.Item>
                  </DropdownButton>
                </OverlayTrigger>
              )}
            </ButtonGroup>
          </div>
        </SurfaceComponent>
      )}

      {/* Course list */}
      <SurfaceComponent className={styles.courseList}>
        {courses.length > 0 ? (
          <ListGroup variant="flush" className={styles.courseListGroup}>
            {courses.map(course => (
              <WorksheetCalendarListItem
                key={viewedSeason + course.crn}
                listing={course.listing}
                hidden={course.hidden ?? false}
                color={course.color}
              />
            ))}
          </ListGroup>
        ) : (
          <NoCourses heading={...}>
            {/* Empty state with term-switch chips */}
          </NoCourses>
        )}
      </SurfaceComponent>
    </div>
  );
}
```

### Sidebar Controls CSS (`WorksheetCalendarList.module.css`)

```css
.container {
  position: sticky;
  top: var(--height-navbar);
  z-index: 2;
  background-color: var(--color-bg);
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  box-shadow: 0 2px 6px 0 var(--color-shadow);
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.icon {
  transition: transform 0.3s !important;
}
.calendarIcon {
  color: var(--color-text);
}

.button {
  padding: 5px;
  text-align: center;
  border: solid 2px var(--color-border-control);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  margin-bottom: 5px;
  background-color: var(--color-select);
  color: var(--color-text);
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.button:hover {
  background-color: var(--color-surface-active) !important;
  color: var(--color-text) !important;
  border: 2px solid hsl(0deg 0% 70%);
}

.button:hover .icon {
  transform: scale(1.15);
}

.courseList {
  overflow-x: hidden;
  padding: 8px;
  background: #fafafa;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  box-shadow: 0 2px 6px 0 var(--color-shadow);
}

.courseListGroup {
  display: grid;
  gap: 6px;
}

/* Empty state term chips */
.emptyTermChips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.emptyTermChip {
  border: 1px solid var(--color-border-control);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: var(--color-select);
  color: var(--color-text);
  font-weight: 600;
}

.emptyTermChip:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-active);
  color: var(--color-primary);
}
```

---

## 7. Course Card: `WorksheetCalendarListItem.tsx`

Each course in the sidebar list. Shows a color bar, course code + section, truncated title, a hide button (appears on hover), and a chevron to expand exam details.

```tsx
// frontend/src/components/Worksheet/WorksheetCalendarListItem.tsx

function WorksheetCalendarListItem({ listing, hidden, color }) {
  const [expanded, setExpanded] = useState(false);
  const examDetails = useMemo(() => buildExamDetails(listing), [listing]);

  return (
    <ListGroup.Item className={clsx(
      styles.listItem,
      expanded && styles.listItemExpanded,
      hidden && styles.listItemHidden,
    )}
      onMouseEnter={() => setHoverCourse(listing.crn)}
      onMouseLeave={() => setHoverCourse(null)}
    >
      <div className={styles.cardHeader}>
        {/* Color bar toggle */}
        <button className={styles.headerToggle} onClick={() => setExpanded(!expanded)}>
          <span className={styles.colorBar} style={{ backgroundColor: color }} />
        </button>

        {/* Course info link */}
        <Link to={target} className={clsx(styles.courseCode, hidden && styles.courseCodeHidden)}>
          <span className={styles.courseCodeLine}>
            <strong>{listing.course_code}</strong>
            <span className={styles.sectionCode}>{formatWorksheetSectionSuffix(listing)}</span>
          </span>
          <span className={styles.courseTitle}>{listing.course.title}</span>
        </Link>

        {/* Hide button (appears on hover) */}
        <WorksheetHideButton crn={listing.crn} hidden={hidden}
          className={clsx(styles.hideButton, !hidden && styles.hideButtonHidden)} />

        {/* Expand chevron */}
        <button className={styles.chevronButton} onClick={() => setExpanded(!expanded)}>
          <FiChevronDown className={styles.chevronIcon} />
        </button>
      </div>

      {/* Expanded: exam details */}
      {expanded && (
        <div className={styles.examPanel}>
          {examDetails.map(exam => (
            <div className={styles.examRow}>
              <span className={styles.examDot} style={{ backgroundColor: color }} />
              <div className={styles.examText}>
                <div className={styles.examTitleLine}>
                  <span className={styles.examKind}>{exam.kind}</span>
                  {label && <span className={clsx(styles.countdownBadge, countdownClass(...))}>{label}</span>}
                </div>
                <div className={styles.examDate}>{formatExamDate(exam.date)}</div>
                <div className={styles.examMeta}>{exam.time} · {exam.location}</div>
              </div>
            </div>
          ))}
          <div className={styles.cardFooter}>
            <WorksheetToggleButton listing={listing} inWorksheet appearance="remove" />
          </div>
        </div>
      )}
    </ListGroup.Item>
  );
}
```

### Course Card CSS (`WorksheetCalendarListItem.module.css`)

```css
.listItem {
  display: block;
  overflow: hidden;
  padding: 0;
  background: #fff;
  border: 0;
  border-radius: 8px !important;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  transition:
    box-shadow 0.25s ease,
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.listItemExpanded {
  box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
}
.listItemHidden {
  color: var(--color-hidden);
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 12px;
  transition: background-color 0.12s ease;
}

.cardHeader:hover {
  background: #f7f7f9;
}

.headerToggle {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 4px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.colorBar {
  display: block;
  width: 4px;
  height: 32px;
  border-radius: 2px;
}

.courseCode {
  flex: 1 1 auto;
  min-width: 0;
  color: #1a1a1a;
  text-decoration: none;
}

.courseCodeLine {
  display: block;
  font-size: 14px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sectionCode {
  color: #999;
  font-size: 13px;
  font-weight: 400;
}

.courseTitle {
  display: block;
  width: 100%;
  margin-top: 1px;
  color: #777;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevronButton {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid #e4e4e9;
  border-radius: 6px;
  color: #888;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.chevronIcon {
  width: 14px;
  height: 14px;
  stroke-width: 2.5;
  transition: transform 0.2s ease;
}

.listItemExpanded .chevronIcon {
  transform: rotate(180deg);
}

.hideButton {
  flex: 0 0 auto;
  background-color: transparent;
}
.hideButtonHidden {
  opacity: 0;
  transition: 0.05s opacity;
}
.listItem:hover .hideButtonHidden {
  opacity: 1;
}

/* Exam details panel */
.examPanel {
  padding: 4px 14px 10px 28px;
  border-top: 1px solid #f0f0f3;
}

.examRow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}

.examDot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 999px;
}

.examKind {
  color: #222;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.countdownBadge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.countdownPast {
  background: #f0f0f0;
  color: #888;
}
.countdownSoon {
  background: #fee2e2;
  color: #b91c1c;
}
.countdownUpcoming {
  background: #fef3c7;
  color: #92400e;
}
.countdownLater {
  background: #e8f5e9;
  color: #2e7d32;
}

.examDate {
  margin-top: 2px;
  color: #555;
  font-size: 12px;
}
.examMeta {
  color: #888;
  font-size: 11px;
}

.cardFooter {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f3;
}

@keyframes highlight-flash {
  0% {
    background-color: #eaf0ff;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 4%),
      0 0 0 2px rgb(74 108 247 / 35%);
  }
  60% {
    background-color: #f5f7ff;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 4%),
      0 0 0 1px rgb(74 108 247 / 12%);
  }
  100% {
    background-color: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  }
}
```

---

## Data Model Summary

### `WorksheetCourse`

- `crn: Crn` — unique course registration number
- `color: string` — hex color assigned to this course
- `listing: CatalogListing` — full course listing data
- `hidden: boolean | null` — whether course is hidden from calendar view

### `CatalogListing` (key fields)

- `crn: Crn`
- `course_code: string` — e.g. "ECE 15"
- `course.title: string` — e.g. "Engineering Computation: Introduction to Programming"
- `course.credits: number | null`
- `course.section: string | null`
- `course.last_updated: string | null` — ISO date string
- `course.course_meetings[]: { days_of_week, start_time, end_time, location: { building: { code }, room }, date?, meeting_type? }`
- `course.course_professors[]: { professor: { name } }`
- `course.listings[]: { course_code }` — cross-listings

### `CourseRBCEvent` (react-big-calendar event)

- `kind: 'course'`
- `title: string` — course code with section
- `description: string` — course title
- `start: Date`, `end: Date`
- `listing: CatalogListing`
- `color: string` — hex color
- `location: string`
- `walkBefore?: WalkBefore` — walking time data from previous class

### `WalkBefore`

- `minutes: number` — estimated walking time
- `gapMinutes: number` — time gap between classes
- `fromCode: string`, `toCode: string` — building codes
- `fromClass: WalkClassSummary`, `toClass: WalkClassSummary`

---

## Design Tokens (CSS Variables)

The app uses CSS custom properties for theming. Key tokens used by Worksheet components:

### Brand / Primary

- `--color-primary: #1a56db` — accent/brand blue
- `--color-primary-hover: #1548b8` — hover state
- `--color-primary-light: #e8f0fe` — light accent background

### Text

- `--color-text-dark: #1a1a2e` — primary text
- `--color-text: var(--color-text-dark)` — default text
- `--color-text-secondary: #33354d`
- `--color-text-tertiary: #4a4d68`
- `--color-text-light: #fafafa` — text on dark backgrounds
- `--color-hidden: #b0b3be` — hidden/disabled text

### Backgrounds & Surfaces

- `--color-bg: #fff` — page background
- `--color-surface: #fff` — card/panel background
- `--color-surface-hover: #f4f6fa`
- `--color-surface-active: #e8f0fe`
- `--color-select: #fff` — input/select background
- `--color-bg-button: #e4e5eb` — button background

### Borders & Shadows

- `--color-border: #e8e9ef` — default border
- `--color-border-control: #dcdee6` — input/control border
- `--color-shadow: rgb(0 0 0 / 20%)` — box-shadow base
- `--color-icon: #9a9db4` — icon default color

### Typography

- `--font-family-sans-serif: 'Inter', system-ui, -apple-system, sans-serif`
- `--font-family-logo: 'Cormorant Garamond', serif`

### SunGrid Brand Tokens

- `--sg-primary: #1a56db`
- `--sg-logo-sun: #0e9ae9`
- `--sg-logo-grid: #182b50`
- `--sg-danger-red: #e8446a`
- `--sg-green-bar: #22c55e`

### Transition

- `--trans-dur: 0.2s` — standard transition duration

---

## Interaction Patterns

- **Calendar/List toggle**: ToggleButtonGroup in navbar switches between calendar and list views. On mobile, becomes a dropdown.
- **Course hover**: Hovering a course card in the sidebar highlights the corresponding calendar event (saturated color) and dims all others (alpha 0.3). Uses `hoverCourse` state in the store.
- **Adaptive event content**: Calendar event blocks measure available height and progressively hide lines (title → location → last updated) that don't fit.
- **Hide/Show courses**: Eye icon on each course card and in controls row toggles course visibility on the calendar. Hidden courses get dimmed text (`--color-hidden`).
- **Expand/collapse summary**: "Summary" header toggles the stats panel open/closed using Bootstrap `Collapse`.
- **Expand/collapse course card**: Chevron button on each card expands to show exam details (Midterm/Final dates, countdown badges, locations).
- **Calendar controls cluster**: Expand button (top-right of calendar card) reveals lock and settings buttons on hover with a smooth opacity transition.
- **Walk time badge**: When walking times are enabled, a pill badge appears above event blocks showing estimated walk time between consecutive classes. Clicking opens a modal with route details.
- **Color-coded stat pills**: Course count and credit count pills use chroma-js color scales (green → yellow → red) to indicate load.
- **Export dropdown**: Calendar export icon button opens a dropdown with ICS and URL export options.
- **Current time indicator**: A blue line with a dot shows the current time in the calendar grid.
- **Event click → Course modal**: Clicking a calendar event opens the course detail modal via URL search params (`course-modal=seasonCode-crn`).
