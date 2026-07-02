# SunGrid — Worksheet List View Component Reference for Redesign

This document contains all key component code for the Worksheet List View page.
The Worksheet page lets students manage their course schedule: view added courses, toggle visibility, see summary stats (total courses/credits), and export the schedule. The "List" view shown in the screenshot displays courses as card items with a collapsible summary panel and toolbar controls.

**Tech stack**: React 18, TypeScript, Zustand 5 (with immer), React Bootstrap 5.3, CSS Modules, chroma-js, react-icons, clsx, sonner (toasts)

---

## Page Layout Overview

The page uses a single-column centered layout (`max-width: 920px`) when the List view is active on desktop.

- **Top Navigation Bar** — Sticky header (72px). Contains: SunGrid logo (left), Calendar/List toggle + term/worksheet selectors (center), dark mode button + Catalog/Worksheet nav links + user avatar (right).
- **Summary Panel** — Collapsible `<Collapse>` region with a "Summary" toggle button. Shows "Total courses" and "Total credits" as color-coded stat pills (green-to-red gradient via chroma-js).
- **Toolbar / Controls Row** — Sticky toolbar with a `ButtonGroup` containing: eye icon (show/hide all), gear icon (worksheet settings), calendar-down icon (export dropdown with ICS/URL options).
- **Course Card List** — A `ListGroup` of course items. Each card has: a colored left bar, course code + section, course title, optional "HIDDEN" state, a hide/show eye button (appears on hover), and an expand chevron for exam details.
- **Footer** — SunGrid logo, copyright year, and "Explore" section links.

---

## 1. App Layout: `App.tsx`

The top-level layout wraps the entire app. The Worksheet page renders inside this shell.

```tsx
// frontend/src/App.tsx (simplified)
function App() {
  const location = useLocation();
  useInitStore();

  return (
    <div
      className={
        location.pathname === '/catalog' ? styles.catalogLayout : styles.layout
      }
    >
      <Helmet>
        <title>SunGrid</title>
      </Helmet>
      <SeoMeta />
      <Notice id={26} />
      <TopNav />
      <Routes>
        {/* ... */}
        <Route path="/worksheet" element={<Worksheet />} />
        {/* ... */}
      </Routes>
      {location.pathname !== '/catalog' && <Footer />}
      <Tutorial />
      <ModalHistoryBridge />
      <Modal />
    </div>
  );
}
```

### App Layout CSS (`App.module.css`)

```css
.layout {
  --height-navbar: 72px;
}

.catalogLayout {
  --height-navbar: 72px;
}
```

---

## 2. Top Navigation: `TopNav.tsx`

The sticky top nav bar with logo, worksheet controls, and navigation links.

```tsx
// frontend/src/components/Navbar/TopNav.tsx
export default function TopNav() {
  const authStatus = useStore((state) => state.authStatus);
  const refreshAuth = useStore((state) => state.refreshAuth);
  const isMobile = useStore((state) => state.isMobile);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showCatalogSearch = !isMobile && location.pathname === '/catalog';
  const isWorksheetPage = location.pathname === '/worksheet';

  return (
    <header className={styles.container}>
      <nav
        className={clsx(
          styles.topRow,
          (showCatalogSearch || isWorksheetPage) && styles.topRowPrimary,
        )}
      >
        <NavLink
          to="/"
          className={styles.logoLink}
          onClick={scrollToTop}
          aria-label="SunGrid home"
        >
          <Logo />
        </NavLink>

        {showCatalogSearch && <CatalogNavSearch />}
        {isWorksheetPage && (
          <div className={styles.searchArea}>
            <NavbarWorksheetSearch isMobile={isMobile} />
          </div>
        )}

        {!showCatalogSearch && !isWorksheetPage && (
          <div className={styles.spacer} />
        )}

        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div
          className={clsx(styles.navActions, menuOpen && styles.navActionsOpen)}
        >
          <DarkModeButton className={styles.settingsBtn} />
          <NavLink
            to={createCatalogLink()}
            className={({ isActive }) =>
              clsx(styles.navTab, isActive && styles.navTabActive)
            }
            onClick={(e) => {
              scrollToTop(e);
              setMenuOpen(false);
            }}
          >
            Catalog
          </NavLink>
          <NavLink
            to="/worksheet"
            className={({ isActive }) =>
              clsx(styles.navTab, isActive && styles.navTabActive)
            }
            onClick={(e) => {
              scrollToTop(e);
              setMenuOpen(false);
            }}
            data-tutorial="worksheet-1"
          >
            Worksheet
          </NavLink>
          {isMobile ? (
            <button
              type="button"
              className={styles.navTab}
              onClick={
                authStatus !== 'authenticated'
                  ? () => {
                      window.location.href = '/login';
                    }
                  : async () => {
                      await logout();
                      await refreshAuth();
                      window.location.href = '/';
                    }
              }
            >
              {authStatus !== 'authenticated' ? 'Sign in (beta)' : 'Sign out'}
            </button>
          ) : (
            <MeDropdown />
          )}
        </div>
      </nav>
    </header>
  );
}
```

### TopNav CSS (`TopNav.module.css`)

```css
.container {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  background: var(--color-bg);
  transition: background-color var(--trans-dur);
}

.topRow {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--sg-border);
  flex-wrap: wrap;
}

.topRowPrimary {
  align-items: center;
  flex-wrap: nowrap;
  min-height: var(--height-navbar);
}

.logoLink {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 5px;
  padding-bottom: 5px;
  text-decoration: none;
}

.searchArea {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.spacer {
  flex: 1;
}

.menuToggle {
  display: none;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--sg-text-muted);
  align-items: center;
  justify-content: center;
  align-self: center;
}

.menuToggle:hover {
  background: #f0f0f5;
}

.navActions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.settingsBtn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--sg-text-muted);
  transition: background 0.15s;
}

.settingsBtn:hover {
  background: #f0f0f5;
}

.navTab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  padding: 6px 14px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--sg-text-tertiary);
  border-radius: 8px;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}

.navTab:hover {
  background: #f0f0f5;
  color: var(--sg-text-tertiary);
  text-decoration: none;
}

.navTabActive {
  font-weight: 600;
  color: var(--sg-primary);
}
.navTabActive:hover {
  background: var(--sg-primary-light);
  color: var(--sg-primary);
}

@media (max-width: calc(768px - 0.5px)) {
  .topRow {
    padding: 10px 16px;
  }
  .menuToggle {
    display: flex;
  }
  .spacer {
    display: none;
  }
  .navActions {
    display: none;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding-top: 8px;
    gap: 2px;
  }
  .navActionsOpen {
    display: flex;
  }
  .navTab {
    width: 100%;
    padding: 8px 14px;
  }
  .settingsBtn {
    margin-bottom: 4px;
  }
}
```

---

## 3. Logo: `Logo.tsx`

```tsx
// frontend/src/components/Navbar/Logo.tsx
function Logo() {
  return (
    <span className={styles.logo}>
      <span className={styles.sun}>Sun</span>
      <span className={styles.grid}>Grid</span>
    </span>
  );
}
```

### Logo CSS (`Logo.module.css`)

```css
.logo {
  font-family: var(--font-family-logo);
  font-size: 20px;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
}

.sun {
  font-weight: 600;
  font-style: italic;
  color: var(--sg-logo-sun);
}

.grid {
  font-weight: 700;
  color: var(--sg-logo-grid);
}
```

---

## 4. Navbar Worksheet Controls: `NavbarWorksheetSearch.tsx`

The Calendar/List toggle, term selector, and worksheet selector that appear in the navbar on the worksheet page.

```tsx
// frontend/src/components/Worksheet/NavbarWorksheetSearch.tsx (desktop path, simplified)
export function NavbarWorksheetSearchView({ isMobile, worksheetView, changeWorksheetView, ... }) {
  const visibleWorksheetView = worksheetView === 'list' ? worksheetView : 'calendar';

  // Desktop: full toggle with controls
  return (
    <div className={styles.container}>
      <ToggleButtonGroup
        name="worksheet-view-toggle"
        type="radio"
        value={visibleWorksheetView}
        onChange={(val) => changeWorksheetView(val)}
        className={styles.toggleButtonGroup}
        data-tutorial="worksheet-2"
      >
        <ToggleButton id="view-toggle-calendar" className={styles.toggleButton} value="calendar">
          Calendar
        </ToggleButton>
        <ToggleButton id="view-toggle-list" className={styles.toggleButton} value="list">
          List
        </ToggleButton>
      </ToggleButtonGroup>

      {/* For saved worksheet accounts: term + worksheet selectors */}
      {hasSavedWorksheetAccount ? (
        <SavedWorksheetHeaderControlsView ... />
      ) : (
        <SeasonDropdown mobile={false} />
      )}
    </div>
  );
}
```

### NavbarWorksheetSearch CSS (`NavbarWorksheetSearch.module.css`)

```css
.container {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 0;
  min-width: 0;
  width: 100%;
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

/* ... additional saved worksheet menu styles omitted for brevity ... */
```

---

## 5. Worksheet Page: `Worksheet.tsx`

The page-level component. In List view on desktop, it simply renders `<WorksheetList />`.

```tsx
// frontend/src/pages/Worksheet.tsx (simplified)
function Worksheet() {
  // ... zustand state extraction ...
  const isListView = worksheetView === 'list';
  if (isListView && !isMobile) return <WorksheetList />;

  // Calendar view (default) — not shown in the screenshot
  return (
    <div className={styles.container}>
      <SurfaceComponent className={styles.calendar}>
        <WorksheetCalendar showWalkingTimes={false} />
      </SurfaceComponent>
      <div className={styles.calendarSidebar}>
        <WorksheetStats />
        <WorksheetCalendarList ... />
      </div>
    </div>
  );
}
```

### Worksheet Page CSS (`Worksheet.module.css`)

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

## 6. Worksheet List Container: `WorksheetList.tsx`

Simple wrapper for the list view layout.

```tsx
// frontend/src/components/Worksheet/WorksheetList.tsx
function WorksheetList() {
  const emptyMissingBuildingCodes = useMemo(() => new Set<string>(), []);

  return (
    <div className={styles.container}>
      <WorksheetStats />
      <WorksheetCalendarList
        highlightBuilding={null}
        showLocation
        showMissingLocationIcon={false}
        controlsMode="full"
        missingBuildingCodes={emptyMissingBuildingCodes}
        hideTooltipContext="calendar"
      />
    </div>
  );
}
```

### WorksheetList CSS (`WorksheetList.module.css`)

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(920px, calc(100% - 2rem));
  margin: 1rem auto;
}
```

---

## 7. Summary Panel: `WorksheetStats.tsx`

The collapsible summary section showing total courses and credits with color-coded pills.

```tsx
// frontend/src/components/Worksheet/WorksheetStats.tsx
function StatPill({ colorMap, stat, children }) {
  const theme = useStore((state) => state.theme);
  return (
    <dd className={styles.statPill}
      style={{ backgroundColor: colorMap(stat).alpha(theme === 'light' ? 1 : 0.75).css() }}>
      {children}
    </dd>
  );
}

const courseNumberColormap = chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 6]);
const creditColormap = chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 5.5]);

export function WorksheetStatsView({ courses, isExoticWorksheet, exoticWorksheet, ... }) {
  const [shown, setShown] = useState(true);

  // Count unique courses and credits (skip hidden, discussion sections, cross-listings)
  let courseCnt = 0;
  let credits = 0;
  // ... counting logic ...

  return (
    <div className={clsx(shown ? 'dropdown' : 'dropup', styles.statsContainer)}>
      <div className={styles.toggleButton}>
        <button type="button" className="dropdown-toggle" onClick={() => setShown(!shown)}>
          Summary
        </button>
      </div>
      <Collapse in={shown}>
        <div>
          <div className={styles.stats}>
            <dl>
              <div>
                <dt>Total courses</dt>
                <StatPill colorMap={courseNumberColormap} stat={courseCnt}>
                  {courseCnt}
                </StatPill>
              </div>
              <div>
                <dt>Total credits</dt>
                <StatPill colorMap={creditColormap} stat={credits}>
                  {credits}
                </StatPill>
              </div>
            </dl>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
```

### WorksheetStats CSS (`WorksheetStats.module.css`)

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

.worksheetInfo {
  text-align: center;
  padding: 0 0 0.5em;
  margin-top: -0.5em;
  margin-bottom: 0.5em;
}

.worksheetName {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.creatorName {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
}
```

---

## 8. Toolbar / Controls: `WorksheetCalendarList.tsx`

The toolbar with show/hide-all, settings, and export buttons, plus the course list container.

```tsx
// frontend/src/components/Worksheet/WorksheetCalendarList.tsx (controls section, simplified)
function WorksheetCalendarList({ highlightBuilding, showLocation, showMissingLocationIcon, controlsMode, ... }) {
  // ... state from zustand ...
  const areHidden = useMemo(() => courses.length > 0 && courses.every((course) => course.hidden), [courses]);
  const HideShowIcon = areHidden ? BsEyeSlash : BsEye;

  return (
    <div>
      {showControls && (
        <SurfaceComponent elevated className={styles.container}>
          <div className="shadow-sm p-2">
            <ButtonGroup className="w-100">
              {/* Show/Hide All button */}
              {showHideButton && !isReadonlyWorksheet && (
                <OverlayTrigger placement="top"
                  overlay={(props) => <Tooltip {...props}><span>{areHidden ? 'Show' : 'Hide'} all</span></Tooltip>}>
                  <Button onClick={async () => { /* toggle all visibility */ }}
                    variant="none" className={clsx(styles.button, 'px-3 w-100')}
                    aria-label={`${areHidden ? 'Show' : 'Hide'} all`}>
                    <HideShowIcon className={clsx(styles.icon, 'my-auto pe-2')} size={32} />
                  </Button>
                </OverlayTrigger>
              )}

              {/* Settings button */}
              {showSettings && (
                <OverlayTrigger placement="top"
                  overlay={(props) => <Tooltip {...props}><span>Worksheet Settings</span></Tooltip>}>
                  <Button onClick={(e) => { e.stopPropagation(); setSettingsModalOpen(true); }}
                    variant="none" className={clsx(styles.button, 'px-3 w-100')}
                    aria-label="Worksheet Settings">
                    <CiSettings className={clsx(styles.icon)} size={32} />
                  </Button>
                </OverlayTrigger>
              )}

              {/* Export dropdown */}
              {showExport && (
                <OverlayTrigger placement="top"
                  overlay={(props) => <Tooltip {...props}><span>Export worksheet calendar</span></Tooltip>}>
                  <DropdownButton as="div" drop="down" align="end"
                    title={<TbCalendarDown className={clsx(styles.icon, styles.calendarIcon)} size={22} />}
                    variant="none" className={clsx(styles.button, 'w-100 btn')}>
                    <Dropdown.Item eventKey="1" as="div"><ICSExportButton /></Dropdown.Item>
                    <Dropdown.Item eventKey="2" as="div"><URLExportButton /></Dropdown.Item>
                  </DropdownButton>
                </OverlayTrigger>
              )}
            </ButtonGroup>
          </div>
        </SurfaceComponent>
      )}

      {/* Course list */}
      <SurfaceComponent className={styles.courseList}>
        <WorksheetCalendarListContext.Provider value={contextValue}>
          {courses.length > 0 ? (
            <ListGroup variant="flush" className={styles.courseListGroup}>
              {courses.map((course) => (
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
              {/* empty state with term chip buttons */}
            </NoCourses>
          )}
        </WorksheetCalendarListContext.Provider>
      </SurfaceComponent>
    </div>
  );
}
```

### WorksheetCalendarList CSS (`WorksheetCalendarList.module.css`)

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

.button:active {
  background-color: var(--color-surface-active) !important;
}
.button:disabled {
  background-color: transparent;
  color: var(--color-text-tertiary) !important;
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

.emptyTermContent {
  display: grid;
  gap: 0.75rem;
  justify-items: center;
}

.emptyTermText {
  margin: 0;
  color: var(--color-text-secondary);
}

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
  transition:
    background-color var(--trans-dur),
    border-color var(--trans-dur),
    color var(--trans-dur);
}

.emptyTermChip:hover,
.emptyTermChip:focus {
  border-color: var(--color-primary);
  background: var(--color-surface-active);
  color: var(--color-primary);
}
```

---

## 9. Course Card Item: `WorksheetCalendarListItem.tsx`

Each course in the list. Contains a colored bar, course info, hide button, expand chevron, and an expandable exam details panel.

```tsx
// frontend/src/components/Worksheet/WorksheetCalendarListItem.tsx (simplified)
export default function WorksheetCalendarListItem({ listing, hidden, color }) {
  const target = useCourseModalLink(listing);
  const setHoverCourse = useStore((state) => state.setHoverCourse);
  const [expanded, setExpanded] = useState(false);
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
        {/* Color bar (clickable to expand) */}
        <button
          type="button"
          className={styles.headerToggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <span
            className={styles.colorBar}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        </button>

        {/* Course code + title link */}
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
            <span className={styles.courseLocation}>{locationDisplay}</span>
          )}
        </Link>

        {/* Hide/show button (visible on hover) */}
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

        {/* Expand chevron */}
        <button
          type="button"
          className={styles.chevronButton}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <FiChevronDown className={styles.chevronIcon} aria-hidden="true" />
        </button>
      </div>

      {/* Expandable exam panel */}
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
```

### WorksheetCalendarListItem CSS (`WorksheetCalendarListItem.module.css`)

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
  text-align: left;
  overflow: hidden;
  transition: color var(--trans-dur);
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

.courseCodeLine strong {
  font-weight: 700;
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

.courseCodeHidden {
  color: var(--color-hidden);
}
.courseCodeHidden .courseTitle {
  color: var(--color-hidden);
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

.chevronButton:hover,
.chevronButton:focus-visible {
  background: #f3f3f7;
  border-color: #d4d4da;
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

/* Hide button appears only on hover */
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
@media (max-width: calc(768px - 0.5px)) {
  .hideButtonHidden {
    opacity: 1;
  }
}

/* Exam panel (expanded state) */
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

.examDotMuted {
  opacity: 0.5;
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
  line-height: 1.3;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
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
  line-height: 1.25;
}
.examMeta {
  color: #888;
  font-size: 11px;
  line-height: 1.3;
}
.examDivider {
  margin-left: 18px;
  border-top: 1px dashed #e8e8ec;
}
.noExamDetails {
  padding: 12px 0 10px 18px;
  color: #aaa;
  font-size: 12px;
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

.listItemHighlighted {
  animation: highlight-flash 0.9s ease forwards;
}
```

---

## 10. Hide Button: `WorksheetHideButton.tsx`

The per-course visibility toggle (eye/eye-slash icon).

```tsx
// frontend/src/components/Worksheet/WorksheetHideButton.tsx
export default function WorksheetHideButton({
  hidden,
  crn,
  className,
  color,
  context = 'calendar',
}) {
  const buttonLabel =
    context === 'map'
      ? hidden
        ? 'Show on map'
        : 'Hide from map'
      : hidden
        ? 'Show in calendar'
        : 'Hide from calendar';

  return (
    <OverlayTrigger
      placement="bottom"
      overlay={(props) => (
        <Tooltip {...props}>
          <small>{buttonLabel}</small>
        </Tooltip>
      )}
    >
      <Button
        variant="toggle"
        onClick={async (e) => {
          e.stopPropagation(); /* toggle logic */
        }}
        className={clsx(styles.toggleButton, className)}
        aria-label={buttonLabel}
      >
        {hidden ? (
          <BsEyeSlash color="var(--color-hidden)" size={18} />
        ) : (
          <BsEye color={color ?? 'var(--color-text-dark)'} size={18} />
        )}
      </Button>
    </OverlayTrigger>
  );
}
```

### WorksheetHideButton CSS (`WorksheetHideButton.module.css`)

```css
.toggleButton {
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
```

---

## 11. Remove Course Button: `WorksheetToggleControls.tsx`

The add/remove button shown in the expanded card footer.

```tsx
// frontend/src/components/Worksheet/WorksheetToggleControls.tsx
export function RemoveWorksheetButton({
  disabled,
  ariaLabel,
  className,
  onClick,
}) {
  return (
    <Button
      variant="toggle"
      className={clsx(styles.removeButton, className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <BsTrash size={13} aria-hidden="true" />
      <span>Remove this course</span>
    </Button>
  );
}
```

### WorksheetToggleControls CSS (`WorksheetToggleControls.module.css`)

```css
.removeButton {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: transparent !important;
  border: 0 !important;
  border-radius: 6px;
  color: #aaa !important;
  font-size: 12px;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.removeButton:hover,
.removeButton:focus-visible {
  background: #fef2f2 !important;
  color: #c94040 !important;
}

.removeButton:disabled {
  color: #c7c7c7 !important;
  cursor: not-allowed;
}
```

---

## 12. Worksheet Status Icon: `WorksheetStatusIcon.tsx`

Icon shown next to worksheet names (star for main, lock/unlock for others).

```tsx
// frontend/src/components/Worksheet/WorksheetStatusIcon.tsx
export default function WorksheetStatusIcon(worksheetNumber, isPrivate) {
  return (
    <div className={styles.statusIconContainer}>
      {worksheetNumber === 0 ? (
        <FaStar />
      ) : isPrivate ? (
        <FaLock style={{ transform: 'scale(0.85)' }} />
      ) : (
        <FaUnlock style={{ transform: 'scale(0.85)' }} />
      )}
    </div>
  );
}
```

### WorksheetStatusIcon CSS (`WorksheetStatusIcon.module.css`)

```css
.statusIconContainer {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 13. Empty State: `NoCourses.tsx`

Displayed when the worksheet has no courses.

```tsx
// frontend/src/components/Search/NoCourses.tsx
function NoCourses({ heading, children }) {
  const viewedSeason = useStore((state) => state.viewedSeason);

  return (
    <div style={{ width: '100%' }} className="d-flex mb-5">
      <div className="text-center m-auto">
        <img
          alt="No courses found."
          className="py-4"
          src={NoCoursesFound}
          style={{ width: '60%', maxWidth: '280px', mixBlendMode: 'multiply' }}
        />
        <h3>
          {heading ?? `No courses found for ${toSeasonString(viewedSeason)}`}
        </h3>
        {children ?? (
          <div>
            Add some courses on the{' '}
            <Link to={createCatalogLink()}>Catalog</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 14. Typography / Surface Components: `Typography.tsx`

Shared wrapper components used throughout the app.

```tsx
// frontend/src/components/Typography.tsx
export function SurfaceComponent({ elevated, className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        styles.surface,
        elevated && styles.surfaceElevated,
        className,
      )}
    />
  );
}

export function TextComponent({
  type,
  small,
  as: As = 'span',
  className,
  ...props
}) {
  return (
    <As
      {...props}
      className={clsx(
        styles.text,
        type === 'secondary'
          ? styles.secondaryText
          : type === 'tertiary'
            ? styles.tertiaryText
            : undefined,
        small && styles.smallText,
        className,
      )}
    />
  );
}
```

### Typography CSS (`Typography.module.css`)

```css
.surface {
  transition: background-color var(--trans-dur);
  background-color: var(--color-surface);
}

.surface.surfaceElevated {
  background-color: var(--color-surface-elevated);
}

.text {
  transition: background-color var(--trans-dur);
  color: var(--color-text);
}

.text.secondaryText {
  color: var(--color-text-secondary);
}
.text.tertiaryText {
  color: var(--color-text-tertiary);
}
.smallText {
  font-size: 70%;
}

.input {
  background-color: var(--color-select);
  color: var(--color-text);
  border: solid 2px var(--color-border-control);
  border-radius: 8px;
  padding: 0.375rem 0.75rem;
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.input:hover {
  border: 2px solid hsl(0deg 0% 70%);
}
```

---

## 15. Footer: `Footer.tsx`

```tsx
// frontend/src/components/Footer.tsx
const links = [
  {
    section: 'Explore',
    items: [
      { name: 'Catalog', to: createCatalogLink() },
      { name: 'Worksheet', to: '/worksheet' },
    ],
  },
];

function Footer() {
  return (
    <Container fluid>
      <footer className={clsx(styles.footer, 'py-5 px-5')}>
        <div className="row">
          <div className="col-12 col-md">
            <span className={styles.footerLogo}>
              <Logo />
            </span>
            <small className="d-block mb-3">
              &copy; {new Date().getFullYear()}
            </small>
          </div>
          {links.map(({ section, items }) => (
            <div key={section} className="col-6 col-md">
              <h5 className={styles.sectionHeading}>{section}</h5>
              <ul className="list-unstyled text-small">
                {items.map(({ name, to }) => (
                  <li key={name}>
                    <NavLink to={to} onClick={scrollToTop}>
                      <TextComponent type="secondary">{name}</TextComponent>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </Container>
  );
}
```

### Footer CSS (`Footer.module.css`)

```css
.footer {
  border-top: 1.5px solid var(--color-border);
  transition: border-color var(--trans-dur);
}

.footerLogo {
  font-size: 2rem;
}
.footer a {
  color: inherit;
}
.footer a:hover {
  color: inherit;
}
.sectionHeading {
  transition: color var(--trans-dur);
}
```

---

## 16. User Menu: `MeDropdown.tsx`

The user avatar dropdown in the top-right corner of the navbar.

```tsx
// frontend/src/components/Navbar/MeDropdown.tsx (simplified)
function MeDropdown() {
  const { elemRef, isComponentVisible, setIsComponentVisible } =
    useComponentVisible(false);
  const user = useStore((state) => state.user);
  const hasName = Boolean(user?.firstName && user.lastName);

  return (
    <div className={clsx(styles.navbarMe, 'align-self-end')}>
      <button
        type="button"
        ref={elemRef}
        className={clsx(hasName ? styles.meIcon : styles.anonIcon, 'm-auto')}
        onClick={() => setIsComponentVisible(!isComponentVisible)}
        aria-label="Profile"
      >
        {hasName ? (
          <span title={`${user.firstName} ${user.lastName}`}>
            {user.firstName[0]}
            {user.lastName[0]}
          </span>
        ) : (
          <BsFillPersonFill
            className="m-auto"
            size={20}
            color={isComponentVisible ? '#007bff' : undefined}
          />
        )}
      </button>
      <DropdownContent
        isExpanded={isComponentVisible}
        setIsExpanded={setIsComponentVisible}
      />
    </div>
  );
}
```

---

## 17. Dark Mode Toggle: `DarkModeButton.tsx`

```tsx
// frontend/src/components/Navbar/DarkModeButton.tsx
function DarkModeButton({ className }) {
  const { theme, toggleTheme } = useStore(
    useShallow((state) => ({
      theme: state.theme,
      toggleTheme: state.toggleTheme,
    })),
  );
  const Icon = theme === 'dark' ? FaRegMoon : ImSun;
  const label = `To ${theme === 'dark' ? 'light' : 'dark'} mode`;

  return (
    <button
      type="button"
      className={clsx(styles.button, className)}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      <Icon size={20} />
    </button>
  );
}
```

---

## Data Model Summary

### `WorksheetCourse`

A course entry in the user's worksheet:

- `crn: Crn` — Course Reference Number (numeric branded type)
- `color: string` — Hex color for the course's visual indicator
- `listing: CatalogListing` — Full catalog listing object
- `hidden: boolean | null` — Whether the course is hidden from the calendar

### `CatalogListing` (key fields)

A course listing from the catalog:

- `crn: Crn` — Unique section identifier
- `course_code: string` — e.g. "DSC 197"
- `course.title: string` — e.g. "Data Science Internship"
- `course.credits: number | null` — Credit count
- `course.listings: Array` — Cross-listed course codes
- `course.course_meetings: Array` — Meeting times, locations, and exam info

### `Season`

A branded string type representing a term code, e.g. `"202501"` for Spring 2025.

### `WorksheetView`

Union type: `'calendar' | 'list' | 'map'`

### `SavedWorksheet`

- `id: number` — Unique worksheet ID
- `name: string` — User-given name (e.g. "Main Worksheet")
- `term: Season` — Which academic term
- `isMain: boolean` — Whether this is the primary worksheet
- `private: boolean` — Visibility setting

### `ExamDetails` (internal)

- `kind: 'Midterm' | 'Final'`
- `date: string` — ISO date string
- `time: string` — Formatted time range
- `location: string` — Building + room
- `daysUntil: number | null` — Countdown for badge display

---

## Design Tokens (CSS Variables)

The app uses CSS custom properties defined in `index.css`:

### Brand / Primary

- `--color-primary: #1a56db` — Primary accent (blue)
- `--color-primary-light: #e8f0fe` — Light primary background
- `--color-primary-hover: #1548b8` — Hover state for primary
- `--sg-primary: #1a56db` — SunGrid brand primary

### Text

- `--color-text-dark: #1a1a2e` — Dark text
- `--color-text: var(--color-text-dark)` — Default text color
- `--color-text-secondary: #33354d` — Secondary text
- `--color-text-tertiary: #4a4d68` — Tertiary text
- `--color-hidden: #b0b3be` — Hidden/disabled text
- `--sg-text-muted: #5a5d7a` — Muted text
- `--sg-text-placeholder: #8b8fa3` — Placeholder text

### Surfaces / Backgrounds

- `--color-bg: #fff` — Page background
- `--color-surface: #fff` — Card/panel background
- `--color-surface-elevated: #fff` — Elevated surface
- `--color-surface-hover: #f4f6fa` — Hover background
- `--color-surface-active: #e8f0fe` — Active/pressed background
- `--color-select: #fff` — Input/select background

### Borders & Shadows

- `--color-border: #e8e9ef` — Default border
- `--color-border-control: #dcdee6` — Form control border
- `--color-shadow: rgb(0 0 0 / 20%)` — Box shadow color
- `--sg-border: #e8e9ef` — SunGrid border token
- `--color-icon: #9a9db4` — Icon default color

### Logo

- `--sg-logo-sun: #0e9ae9` — "Sun" text color (blue)
- `--sg-logo-grid: #182b50` — "Grid" text color (dark navy)

### Typography

- `--font-family-sans-serif: 'Inter', system-ui, -apple-system, sans-serif`
- `--font-family-logo: 'Cormorant Garamond', serif`

### Layout

- `--height-navbar: 72px` — Navbar height
- `--trans-dur: 0.2s` — Default transition duration

### Stat Pill Color Scales (chroma-js)

- Course count: `chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 6])` — green at 4, yellow at 5, red at 6+
- Credits: `chroma.scale(['#63b37b', '#ffeb84', '#f8696b']).domain([4, 5.5])` — green at 4, yellow at ~5, red at 5.5+

---

## Interaction Patterns

- **Calendar/List Toggle**: `ToggleButtonGroup` in the navbar switches between `'calendar'` and `'list'` views. Active button uses `--color-primary` background with white text.
- **Summary Collapse**: The "Summary" button uses Bootstrap `<Collapse>` with a dropdown caret that flips between `dropdown`/`dropup` CSS classes.
- **Hide/Show All**: Eye icon toggles all courses' visibility. Checks `courses.every(c => c.hidden)` to determine current state.
- **Per-Course Hide**: Each card has a hide button that only appears on hover (`.hideButtonHidden { opacity: 0 }`, revealed on `.listItem:hover`). Always visible on mobile.
- **Card Expand**: Clicking the chevron or color bar toggles an exam details panel. Chevron rotates 180deg when expanded.
- **Hover Highlight**: `onMouseEnter` sets `hoverCourse` in the store, which can highlight the same course in the calendar view.
- **Course Modal Link**: The course code/title is a `<Link>` that opens the course detail modal via URL-based routing.
- **Exam Countdown Badges**: Color-coded badges (PAST=gray, SOON=red, UPCOMING=amber, LATER=green) show days until exam.
- **Highlight Flash**: When a course card is highlighted (e.g., from calendar interaction), it plays a blue glow animation over 0.9s.
- **Worksheet Selector**: A `Popout` dropdown shows saved worksheets with star/lock icons, rename/delete actions, and a "New Worksheet" button.
- **Term Selector**: `DropdownMenu` component with season codes sorted by recency.
- **Export Dropdown**: Calendar-down icon opens a dropdown with ICS export and URL export options.
- **Remove Course**: In the expanded panel footer, a trash-icon button with "Remove this course" text, with red hover state.
