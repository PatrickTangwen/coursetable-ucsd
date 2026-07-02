# SunGrid — Catalog List View Component Reference for Redesign

This document contains all key component code for the Catalog List View page.
The page lets students browse, filter, sort, and search UCSD course offerings in a dense table layout. The main user flow: land on page → filter by subject/level/term → scan rows → click "+" to add a course to the worksheet, or click a row to open a course detail modal.

**Tech stack**: React 19, TypeScript, React Bootstrap, CSS Modules, Zustand (state), clsx

---

## Page Layout Overview

The page is a vertical stack occupying 100vh minus the navbar height:

1. **Sticky Navbar** (72px) — full-width, contains the SunGrid logo (left), a wide search input with result count, a dark-mode toggle, "Catalog"/"Worksheet" nav links, and a user avatar dropdown (right).
2. **Filter Bar** — a horizontal flex row with Subject / Course Level / Term dropdown menus, active filter chips (e.g. "Summer Session 1 2026 ×"), a red "Reset" button, and a right-aligned "Updated today" timestamp.
3. **Course Table** — fills remaining height, scrolls vertically. Has a sticky header row and virtualized course rows. Each row shows: add-to-worksheet button, course code, section, title, instructor, day-of-week dots, time, location, seats remaining.

On narrow viewports the table scrolls horizontally with a floating horizontal scrollbar.

---

## 1. Page Container: `CatalogListView.tsx`

The top-level page component. Wires up search data, filter state, and renders the FilterBar + CatalogTable.

```tsx
// frontend/src/pages/CatalogListView.tsx
import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CatalogTable from '../components/Catalog/CatalogTable';
import FilterBar, { COURSE_LEVELS } from '../components/Catalog/FilterBar';
import { useFerry } from '../hooks/useFerry';
import { useSearch } from '../hooks/useSearch';
import type { CatalogListing } from '../queries/api';
import type { Season } from '../queries/graphql-types';
import { buildCatalogListFilterCleanup } from '../search/catalogListFilters';
import type { Option } from '../search/searchTypes';
import { useStore } from '../store';
import styles from './CatalogListView.module.css';

// Extracts unique subject codes from loaded catalog for the Subject dropdown
function extractCatalogSubjects(courses, selectedSeasons) {
  /* ... */
}
function parseCourseNumber(code) {
  /* ... */
}

export default function CatalogListView() {
  const { searchData, coursesLoading } = useSearch();
  const { courses } = useFerry();
  const levelFilter = useStore((s) => s.catalogLevelFilter);
  const searchFilters = useStore((s) => s.searchFilters);
  const patchSearchFilters = useStore((s) => s.patchSearchFilters);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useStore((s) => s.navigate);

  const subjects = useMemo(
    () => extractCatalogSubjects(courses, searchFilters.selectSeasons),
    [courses, searchFilters.selectSeasons],
  );

  // Auto-cleanup incompatible filters when they change
  useEffect(() => {
    const cleanup = buildCatalogListFilterCleanup(searchFilters);
    if (Object.keys(cleanup).length > 0) patchSearchFilters(cleanup);
  }, [patchSearchFilters, searchFilters]);

  // Apply course level filter (Lower/Upper/Graduate) client-side
  const filteredData = useMemo(() => {
    if (!searchData) return null;
    if (!levelFilter) return searchData;
    const level = COURSE_LEVELS.find((l) => l.value === levelFilter);
    if (!level) return searchData;
    return searchData.filter((l) => {
      const num = parseCourseNumber(l.number);
      return num >= level.range[0] && num <= level.range[1];
    });
  }, [searchData, levelFilter]);

  // Open course detail modal
  const handleOpenModal = useCallback(
    (listing) => {
      navigate('push', { type: 'course', data: listing }, searchParams);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(
          'course-modal',
          `${listing.course.season_code}-${listing.crn}`,
        );
        next.delete('prof-modal');
        return next;
      });
    },
    [navigate, searchParams, setSearchParams],
  );

  if (coursesLoading) {
    return (
      <div className={styles.page}>
        <FilterBar subjects={subjects} />
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: '#8b8fa3',
          }}
        >
          Loading courses...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <FilterBar subjects={subjects} />
      <CatalogTable data={filteredData} onOpenModal={handleOpenModal} />
    </div>
  );
}
```

### CatalogListView CSS (`CatalogListView.module.css`)

```css
.page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--height-navbar));
}
```

---

## 2. Navbar: `Navbar.tsx`

The sticky top navigation bar. On the catalog page it shows the search bar inline and the "Updated today" label in the bottom-right.

```tsx
// frontend/src/components/Navbar/Navbar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Nav, Navbar } from 'react-bootstrap';
import DarkModeButton from './DarkModeButton';
import Logo from './Logo';
import MeDropdown from './MeDropdown';
import LastUpdated from '../Search/LastUpdated';
import { NavbarCatalogSearch } from '../Search/NavbarCatalogSearch';
import { SurfaceComponent } from '../Typography';
import styles from './Navbar.module.css';

function NavbarLink({ to, children }) {
  return (
    <NavLink className={styles.navLink} to={to} onClick={scrollToTop}>
      {children}
    </NavLink>
  );
}

export default function AppNavbar() {
  const authStatus = useStore((state) => state.authStatus);
  const location = useLocation();
  const isMobile = useStore((state) => state.isMobile);
  const showCatalogSearch = !isMobile && location.pathname === '/catalog';

  return (
    <SurfaceComponent className={styles.container}>
      <Navbar expand="md" className={clsx(
        'shadow-sm px-3 align-items-start',
        styles.navbar,
        showCatalogSearch && styles.catalogSearchNavbar,
      )}>
        <div className={styles.navLogoWrapper}>
          <Nav className={clsx(styles.navLogo, 'navbar-brand')}>
            <NavLink to="/"><Logo /></NavLink>
          </Nav>
        </div>
        {showCatalogSearch && <NavbarCatalogSearch />}
        <Navbar.Toggle className={styles.navToggle} />
        <NavbarRight wrap={!isMobile}>
          <Navbar.Collapse className={styles.navbarCollapse}>
            <Nav className={styles.navbarLinks}>
              <DarkModeButton className={styles.navbarDarkModeBtn} />
              <NavbarLink to={createCatalogLink()}>Catalog</NavbarLink>
              <NavbarLink to="/worksheet">Worksheet</NavbarLink>
              {isMobile ? (/* mobile auth links */) : <MeDropdown />}
            </Nav>
          </Navbar.Collapse>
          {showCatalogSearch && <LastUpdated />}
        </NavbarRight>
      </Navbar>
    </SurfaceComponent>
  );
}
```

### Navbar CSS (`Navbar.module.css`)

```css
.container {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.catalogSearchNavbar {
  padding-bottom: 0;
}

.navLogo {
  font-size: 1.6rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.navToggle {
  border-color: var(--color-border) !important;
}

@media (min-width: 768px) {
  .navbar {
    height: var(--height-navbar);
  }
  .navbarCollapse {
    display: flex;
    flex-grow: 0;
  }
}

.navbarDarkModeBtn {
  padding-right: 1rem !important;
  transition: 0.1s;
  display: flex;
}

.navLink {
  padding: 0.5rem 1rem 0.5rem 0;
  user-select: none;
  font-weight: 500;
  font-size: 1rem;
  color: var(--color-text-secondary);
  transition: color var(--trans-dur);
}

.navLink:hover {
  text-decoration: none !important;
  color: var(--color-primary);
}

.navLink:global(.active) {
  color: var(--color-primary);
}

.navLogoWrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
}

@media (max-width: calc(1320px - 0.5px)) {
  .navLink {
    font-size: 0.9rem;
  }
  .navLogoWrapper {
    gap: 0.75rem;
  }
}
```

---

## 3. Logo: `Logo.tsx`

The "SunGrid" brand wordmark, using a serif font.

```tsx
// frontend/src/components/Navbar/Logo.tsx
import styles from './Logo.module.css';

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

## 4. DarkModeButton: `DarkModeButton.tsx`

Settings/dark-mode toggle icon in the navbar.

```tsx
// frontend/src/components/Navbar/DarkModeButton.tsx
import { FaRegMoon } from 'react-icons/fa';
import { ImSun } from 'react-icons/im';

function DarkModeButton({ className }) {
  const { theme, toggleTheme } = useStore(/* theme, toggleTheme */);
  const Icon = theme === 'dark' ? FaRegMoon : ImSun;
  return (
    <button
      type="button"
      className={clsx(styles.button, className)}
      onClick={toggleTheme}
      aria-label={`To ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Icon size={20} />
    </button>
  );
}
```

### DarkModeButton CSS (`DarkModeButton.module.css`)

```css
.button {
  margin-top: auto;
  margin-bottom: auto;
  transition: color 0.1s;
  color: var(--color-text-secondary);
}

.button:hover {
  color: var(--color-primary);
}
```

---

## 5. User Avatar Dropdown: `MeDropdown.tsx`

Circular avatar button that opens a dropdown with Profile/Sign-out links.

```tsx
// frontend/src/components/Navbar/MeDropdown.tsx
import { BsFillPersonFill } from 'react-icons/bs';
import { Collapse } from 'react-bootstrap';

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
          <BsFillPersonFill size={20} />
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

### MeDropdown CSS (`MeDropdown.module.css`)

```css
.collapseContainer {
  width: 200px;
  position: absolute;
  top: 56px;
  right: 0;
  z-index: calc(420 + 69);
  box-shadow: 0 2px 6px 0 var(--color-shadow);
  border-radius: 10px;
  transform: translate(0, -10px);
}

.navbarMe {
  margin-top: auto;
  margin-bottom: auto;
}

.meIcon,
.anonIcon {
  width: 30px;
  height: 30px;
  border-radius: 15px;
  display: flex;
  transition:
    border-color var(--trans-dur),
    background-color var(--trans-dur),
    color var(--trans-dur);
}

.meIcon {
  background-color: var(--color-primary);
  color: var(--color-text-light);
  align-items: center;
  justify-content: center;
}

.meIcon span {
  font-weight: bold;
  transform: scaleX(0.8);
}

.anonIcon {
  background-color: var(--color-bg-button);
  color: var(--color-text-secondary);
}

.anonIcon:hover {
  color: var(--color-primary);
}
```

---

## 6. Navbar Search Bar: `NavbarCatalogSearch.tsx`

The wide search input in the navbar, along with filter popouts (Subjects, Skills/Areas, Seasons) and the result count display. On the catalog page, this is the primary search interface.

```tsx
// frontend/src/components/Search/NavbarCatalogSearch.tsx
export function NavbarCatalogSearch() {
  const isTablet = useStore((state) => state.isTablet);
  const searchTextInput = useRef(null);
  const { filters, searchData, coursesLoading, setStartTime } = useSearch();
  const { searchText } = filters;

  return (
    <>
      <Form className="px-0 h-100">
        <div className={styles.row}>
          <div className={styles.searchWrapper}>
            <Input
              className={clsx(
                styles.searchBar,
                searchText.value && styles.searchBarWithValue,
              )}
              type="text"
              value={searchText.value}
              onChange={(event) => {
                searchText.set(event.target.value);
                setStartTime(Date.now());
              }}
              placeholder="Search by course code, title, instructor, or description"
              ref={searchTextInput}
            />
            {searchText.value && (
              <IoClose
                className={styles.searchTextClear}
                size={18}
                onClick={() => {
                  searchText.resetToEmpty();
                  setStartTime(Date.now());
                }}
              />
            )}
          </div>
          <TextComponent type="tertiary" small className={styles.searchSpeed}>
            {coursesLoading
              ? 'Searching ...'
              : `Showing ${searchData?.length ?? 0} results`}
          </TextComponent>
        </div>
        <div className={styles.row}>
          {!isTablet && (
            <>
              <IntersectableSelect
                options={subjectsOptions}
                handle="selectSubjects"
                placeholder="All subjects"
              />
              <IntersectableSelect
                options={skillsAreasOptions}
                handle="selectSkillsAreas"
                placeholder="All areas/skills"
              />
              <Select
                options={seasonsOptions}
                handle="selectSeasons"
                placeholder="Last 5 Years"
              />
            </>
          )}
          <AdvancedPanel />
          <SavedSearchesDropdown />
          <Button
            className={styles.resetButton}
            variant="danger"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>
      </Form>
    </>
  );
}
```

### NavbarCatalogSearch CSS (`NavbarCatalogSearch.module.css`)

```css
.row {
  display: flex;
  align-items: center;
  height: 50%;
  width: auto;
  margin-left: auto;
  margin-right: auto;
}

.searchWrapper {
  display: flex;
  align-items: center;
  width: 40vw;
  height: 100%;
}

.searchBar {
  border-radius: 4px;
  height: 100%;
  font-size: 14px;
}

.searchBarWithValue {
  background-color: var(--color-primary-subdued);
  border-color: var(--color-primary);
}

.searchTextClear {
  z-index: 1000;
  margin-left: -30px;
  cursor: pointer;
  color: var(--color-icon-focus);
  transition: color var(--trans-dur);
}

.searchTextClear:hover {
  color: var(--color-icon-focus-hover);
}

.searchSpeed {
  white-space: pre-line;
  margin-left: 0.5rem;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: end;
}

.resetButton {
  padding: 0.25rem 0.375rem;
  font-size: 12px;
}

@media (max-width: calc(1320px - 0.5px)) {
  .searchWrapper {
    width: 35vw;
  }
  .searchBar {
    font-size: 12px;
  }
  .resetButton {
    font-size: 10px;
  }
}
```

---

## 7. Filter Bar: `FilterBar.tsx`

Horizontal filter row below the navbar. Contains three DropdownMenus (Subject, Course Level, Term), active filter chips, a Reset button, and the "Updated today" label.

```tsx
// frontend/src/components/Catalog/FilterBar.tsx
const COURSE_LEVELS = [
  { value: 'lower', label: 'Lower Division', range: [1, 99] },
  { value: 'upper', label: 'Upper Division', range: [100, 199] },
  { value: 'graduate', label: 'Graduate', range: [200, 999] },
] as const;

function FilterChip({ label, onRemove }) {
  return (
    <span className={styles.chip}>
      {label}
      <button type="button" className={styles.chipClose} onClick={onRemove}
        aria-label={`Remove ${label} filter`}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

function UpdatedLabel({ season }) {
  const { courses } = useFerry();
  const lastUpdated = getCatalogLastUpdated(courses);
  const label = season
    ? getCatalogStalenessLabel(courses, season)
    : `Updated ${toRelativeUpdateTime(lastUpdated)} ago`;
  return (
    <div className={styles.updated}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="6.5" cy="6.5" r="5" />
        <polyline points="6.5,3.5 6.5,6.5 8.5,8" />
      </svg>
      <time title={lastUpdated.toString()} dateTime={lastUpdated.toISOString()}>
        {label}
      </time>
    </div>
  );
}

export default function FilterBar({ subjects }) {
  // Zustand selectors: selectedSubjects, selectedSeasons, levelFilter, setSearchFilter, etc.
  const subjectOptions = subjects.map((s) => ({ value: s, label: formatSubjectLabel(s) }));

  return (
    <div className={styles.container}>
      <DropdownMenu label="Subject" displayLabel={subjectDisplayLabel}
        options={subjectOptions} selectedValues={...} onToggle={handleSubjectToggle}
        searchable searchPlaceholder="All subjects" />
      <DropdownMenu label="Course Level" options={COURSE_LEVELS.map(...)}
        selectedValues={...} onToggle={handleLevelToggle} />
      <DropdownMenu label="Term" options={seasonsOptions}
        selectedValues={...} onToggle={handleTermToggle} />

      {selectedSeasons.length > 0 && <FilterChip label={termChipLabel} onRemove={...} />}
      {selectedSubjects.map((s) => <FilterChip key={s.value} label={s.label} onRemove={...} />)}
      {advancedFilterCount > 0 && <FilterChip label={`Advanced: ${count}`} onRemove={...} />}
      {hasActiveFilters && <button className={styles.resetBtn} onClick={resetAll}>Reset</button>}
      <div className={styles.spacer} />
      <UpdatedLabel season={singleSeason} />
    </div>
  );
}
```

### FilterBar CSS (`FilterBar.module.css`)

```css
.container {
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px 6px 12px;
  background: var(--sg-primary-chip-bg);
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--sg-primary);
}

.chipClose {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--sg-primary);
  transition: background 0.15s;
}

.chipClose:hover {
  background: rgb(26 86 219 / 12%);
}

.resetBtn {
  padding: 7px 16px;
  background: var(--sg-danger-red);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  transition: background 0.15s;
}

.resetBtn:hover {
  background: var(--sg-danger-red-hover);
}

.spacer {
  flex: 1;
}

.updated {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--sg-text-placeholder);
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: calc(768px - 0.5px)) {
  .spacer {
    display: none;
  }
}
```

---

## 8. Dropdown Menu: `DropdownMenu.tsx`

Reusable dropdown used for Subject, Course Level, and Term filters. Supports multi-select with checkboxes, searchable filtering, and animated popover.

```tsx
// frontend/src/components/Catalog/DropdownMenu.tsx
type DropdownMenuOption = { value: string; label: string };

export function DropdownMenu({
  label,
  displayLabel,
  options,
  selectedValues,
  onToggle,
  closeOnToggle = false,
  showCheckbox = true,
  searchable = false,
  searchPlaceholder = 'Search',
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const ref = useRef(null);
  const visibleOptions = normalizedSearchText
    ? options.filter((opt) =>
        `${opt.value} ${opt.label}`
          .toLowerCase()
          .includes(normalizedSearchText),
      )
    : options;

  // Close on outside click
  useEffect(() => {
    /* mousedown listener */
  }, [open]);

  return (
    <div className={styles.dropdownWrapper} ref={ref}>
      <button
        type="button"
        className={clsx(styles.dropdown, open && styles.dropdownOpen)}
        onClick={() => setOpen(!open)}
      >
        {displayLabel ?? label}
        <DropdownChevron />
      </button>
      {open && (
        <div className={styles.dropdownMenu} role="menu">
          {searchable && (
            <div className={styles.searchBox}>
              <input
                type="search"
                className={styles.searchInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {visibleOptions.map((opt) => {
            const selected = selectedValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className={clsx(
                  styles.dropdownItem,
                  selected && styles.dropdownItemActive,
                )}
                role="menuitemcheckbox"
                aria-checked={selected}
                onClick={() => {
                  onToggle(opt.value);
                  if (closeOnToggle) setOpen(false);
                }}
              >
                {showCheckbox && (
                  <span
                    className={clsx(
                      styles.checkbox,
                      selected && styles.checkboxActive,
                    )}
                  >
                    {selected && (
                      <svg viewBox="0 0 10 10">
                        <path
                          d="M2 5.2l1.9 1.9L8 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                )}
                <span className={styles.dropdownItemLabel}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### DropdownMenu CSS (`DropdownMenu.module.css`)

```css
.dropdown {
  padding: 7px 12px;
  border: 1px solid var(--sg-border-light);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--sg-text-tertiary);
  background: var(--sg-bg-white);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}

.dropdown:hover {
  background: var(--sg-bg-input);
}

.dropdownOpen {
  border-color: var(--sg-primary);
  background: var(--sg-bg-input);
}

.dropdownMenu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  background: var(--sg-bg-white);
  border: 1px solid var(--sg-border-light);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 10%);
  padding: 6px;
  min-width: 190px;
  max-height: 280px;
  overflow-y: auto;
  animation: popover-fade-in 0.14s ease-out;
}

.searchBox {
  padding: 4px 4px 8px;
}

.searchInput {
  width: 100%;
  min-width: 260px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--sg-border-light);
  border-radius: 8px;
  color: var(--sg-text-secondary);
  background: var(--sg-bg-white);
  font: inherit;
  font-size: 13px;
  outline: none;
}

.searchInput:focus {
  border-color: var(--sg-primary);
  box-shadow: 0 0 0 2px rgb(26 86 219 / 14%);
}

.dropdownItem {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--sg-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.1s;
}

.dropdownItem:hover {
  background: var(--color-surface-hover);
}

.dropdownItemActive {
  font-weight: 600;
  color: var(--sg-primary);
  background: var(--sg-primary-chip-bg);
}

.checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid var(--sg-border-light);
  border-radius: 3px;
  color: #fff;
  background: var(--sg-bg-white);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkboxActive {
  border-color: var(--sg-primary);
  background: var(--sg-primary);
}

.dropdownWrapper {
  position: relative;
}

.chevronSvg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

@keyframes popover-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 9. Course Table: `CatalogTable.tsx`

The main data table. Features: sticky header, sortable columns (code, title, term, meets), custom virtualization (binary-search-based windowing), expandable multi-section rows, a floating horizontal scrollbar for narrow viewports.

```tsx
// frontend/src/components/Catalog/CatalogTable.tsx

// --- Internal types ---
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

// --- Sort header ---
function SortHeader({ label, sortKey, className }) {
  const { currentKey, asc, setSort } =
    useStore(/* catalogSortKey, catalogSortAsc, setCatalogSort */);
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
      >
        {sortDirection}
      </button>
    </div>
  );
}

// --- Meeting display (day dots + time) ---
function MeetingDisplay({ meetings }) {
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

// --- Location display ---
function LocationDisplay({ meetings }) {
  const [first] = meetings;
  if (!first || first.is_tba) return <span>TBA</span>;
  const parts = [first.building, first.room].filter(Boolean);
  return <span>{parts.join(' ') || 'TBA'}</span>;
}

// --- Term badge ---
function TermBadge({ seasonCode }) {
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

// --- Flat (single-section) row ---
function FlatRow({ row, showTermColumn, onOpenModal }) {
  const group = row.groups[0];
  const firstSection = group.sections[0];
  const instructor = firstSection.instructors[0] ?? 'Staff';
  const meetings =
    group.sharedMeetings.length > 0
      ? group.sharedMeetings
      : firstSection.meetings;
  const listing = row.listings[0];

  return (
    <div
      className={styles.row}
      onClick={() => onOpenModal(listing)}
      role="row"
      tabIndex={0}
    >
      <div className={styles.addCell}>
        <WorksheetToggleButton listing={listing} modal={false} />
      </div>
      <div className={clsx(styles.cell, styles.codeCell)}>
        <span className={styles.courseCode}>{row.courseCode}</span>
        <span className={clsx(styles.sectionSlot, styles.sectionId)}>
          {firstSection.section_code}
        </span>
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

// --- Expandable (multi-section) row ---
function ExpandableRow({ row, showTermColumn, onOpenModal }) {
  const { expanded, toggle } =
    useStore(/* catalogExpandedCourses, toggleCatalogExpanded */);
  // Parent row: click code cell to expand, click title to open modal
  // Expanded: shows sub-rows for each section with WorksheetToggleButton,
  //           section code badge, meeting type badge, per-section seats bar
  // Scrollable sub-row container if > 3 sections
  // ...
}

// --- Main table ---
export default function CatalogTable({ data, onOpenModal }) {
  // Virtualization: binary-search windowing with overscan
  // Sticky header with sort controls
  // Floating horizontal scrollbar

  return (
    <div
      ref={wrapperRef}
      className={styles.tableWrapper}
      onScroll={handleScroll}
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
            {topSpacer}
            {visibleRows.map(renderRow)}
            {bottomSpacer}
          </div>
        )}
      </div>
      {/* Floating horizontal scrollbar */}
      <div
        ref={horizontalScrollbarRef}
        className={clsx(
          styles.horizontalScrollbar,
          !showHorizontalScrollbar && styles.horizontalScrollbarHidden,
        )}
        style={horizontalScrollbarFrame}
      >
        <div
          className={styles.horizontalScrollbarSpacer}
          style={{ width: horizontalScrollWidth }}
        />
      </div>
    </div>
  );
}
```

### CatalogTable CSS (`CatalogTable.module.css`)

```css
.tableWrapper {
  --catalog-action-col: 44px;
  --catalog-cell-font-size: 13.5px;
  --catalog-header-font-size: 11px;
  --catalog-code-gap: 8px;
  --catalog-code-horizontal-padding: 24px;
  --catalog-course-code-slot: 9ch;
  --catalog-section-slot: 92px;
  --catalog-code-col: calc(
    var(--catalog-course-code-slot) + var(--catalog-section-slot) +
      var(--catalog-code-gap) + var(--catalog-code-horizontal-padding)
  );
  --catalog-title-min-col: 220px;
  --catalog-term-col: 86px;
  --catalog-instructor-col: 165px;
  --catalog-meets-col: 220px;
  --catalog-location-col: 100px;
  --catalog-seats-col: 136px;
  --catalog-subrow-scrollbar-gutter: 15px;

  flex: none;
  min-height: auto;
  overflow: auto visible;
  padding: 0 24px 24px;
}

.tableWrapper::-webkit-scrollbar:horizontal {
  height: 0;
}

.horizontalScrollbar {
  position: fixed;
  bottom: 0;
  z-index: 40;
  height: 16px;
  overflow: auto hidden;
  background: var(--sg-bg-white);
  box-shadow: 0 -1px 0 var(--sg-border);
}

.horizontalScrollbarHidden {
  display: none;
}
.horizontalScrollbarSpacer {
  height: 1px;
}
.virtualRows {
  position: relative;
}

.tableInner {
  min-width: calc(
    var(--catalog-action-col) + var(--catalog-code-col) +
      var(--catalog-title-min-col) + var(--catalog-instructor-col) +
      var(--catalog-meets-col) + var(--catalog-location-col) +
      var(--catalog-seats-col)
  );
}

.tableInnerWithTerm {
  min-width: calc(
    var(--catalog-action-col) + var(--catalog-code-col) +
      var(--catalog-title-min-col) + var(--catalog-term-col) +
      var(--catalog-instructor-col) + var(--catalog-meets-col) +
      var(--catalog-location-col) + var(--catalog-seats-col)
  );
}

/* ── Header ── */
.header {
  position: sticky;
  top: 0;
  background: var(--sg-bg-white);
  z-index: 10;
  border-bottom: 2px solid var(--sg-border);
  display: flex;
  align-items: center;
}

.headerCell {
  box-sizing: border-box;
  font-size: var(--catalog-header-font-size);
  font-weight: 600;
  color: var(--sg-text-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 12px;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sortIndicator {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 2px;
  color: var(--sg-primary);
  margin-left: 3px;
  cursor: pointer;
  line-height: 1;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
}

.sortIndicator:hover,
.sortIndicator:focus-visible {
  color: var(--sg-primary-hover);
}

.colAdd {
  width: var(--catalog-action-col);
  flex-shrink: 0;
  padding: 10px 8px 10px 0;
}
.colCode {
  width: var(--catalog-code-col);
  flex-shrink: 0;
}
.colTitle {
  flex: 1;
  min-width: 0;
}
.colTerm {
  width: var(--catalog-term-col);
  flex-shrink: 0;
}
.colInstructor {
  width: var(--catalog-instructor-col);
  flex-shrink: 0;
}
.colMeets {
  width: var(--catalog-meets-col);
  flex-shrink: 0;
}
.colLocation {
  width: var(--catalog-location-col);
  flex-shrink: 0;
}
.colSeats {
  width: var(--catalog-seats-col);
  flex-shrink: 0;
}

/* ── Rows ── */
.row {
  display: flex;
  align-items: center;
  min-height: 45px;
  border-bottom: 1px solid var(--sg-row-separator);
  transition: background 0.1s;
  cursor: pointer;
}

.row:nth-child(even) {
  background: var(--sg-bg-alt-row);
}
.row:hover {
  background: var(--color-surface-hover);
}

.cell {
  box-sizing: border-box;
  padding: 11px 12px;
  font-size: var(--catalog-cell-font-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.addCell {
  box-sizing: border-box;
  width: var(--catalog-action-col);
  flex-shrink: 0;
  padding: 11px 8px 11px 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.codeCell {
  width: var(--catalog-code-col);
  flex-shrink: 0;
  display: grid;
  grid-template-columns: var(--catalog-course-code-slot) minmax(
      0,
      var(--catalog-section-slot)
    );
  align-items: center;
  column-gap: var(--catalog-code-gap);
}

.courseCode {
  font-weight: 700;
  color: var(--sg-text-primary);
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}

.sectionId {
  color: var(--sg-text-placeholder);
  font-weight: 500;
}

.titleCell {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  color: var(--sg-text-secondary);
}

.instructorCell {
  width: var(--catalog-instructor-col);
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--sg-text-muted);
}

.meetsCell {
  width: var(--catalog-meets-col);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.meetTime {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--sg-text-secondary);
  white-space: nowrap;
}

.locationCell {
  width: var(--catalog-location-col);
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--sg-text-muted);
}

.seatsCell {
  width: var(--catalog-seats-col);
  flex-shrink: 0;
  overflow: visible;
}

/* ── Term badge ── */
.termBadge {
  --term-badge-bg: var(--sg-blue-badge-bg);
  --term-badge-text: var(--sg-blue-badge-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--term-badge-bg);
  color: var(--term-badge-text);
  font-size: 10px;
  font-weight: 600;
  line-height: normal;
  white-space: nowrap;
}

.termBadgeFall {
  --term-badge-bg: #f1e5da;
  --term-badge-text: #8b5e3c;
}
.termBadgeWinter {
  --term-badge-bg: #dbeafe;
  --term-badge-text: #1d4ed8;
}
.termBadgeSpring {
  --term-badge-bg: #dff7e6;
  --term-badge-text: #15803d;
}
.termBadgeSummer {
  --term-badge-bg: #ffe5db;
  --term-badge-text: #e8613c;
}

/* ── Expandable parent row ── */
.parentRow {
  display: flex;
  align-items: center;
  min-height: 45px;
  border-bottom: 1px solid var(--sg-row-separator);
  transition: background 0.1s;
  cursor: pointer;
}

.parentRow:hover {
  background: var(--color-surface-hover);
}
.expandedParent {
  background: var(--sg-bg-alt-row);
}

.sectionBadge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--sg-blue-badge-bg);
  color: var(--sg-blue-badge-text);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.chevron {
  transition: transform 0.2s;
  width: 8px;
  height: 8px;
}
.chevronOpen {
  transform: rotate(180deg);
}
.summaryText {
  font-size: 12px;
  color: var(--sg-text-light);
}

/* ── Expandable wrapper ── */
.expandableGroup {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--sg-shadow-expanded);
  margin: 0 0 1px;
}

/* ── Sub-rows ── */
.subRowContainer {
  max-height: 132px;
  overflow: hidden auto;
  border-top: 1px solid #eef0f4;
}

.subRow {
  display: flex;
  align-items: center;
  min-height: 37px;
  background: #fafbfc;
  border-bottom: 1px solid #eef0f4;
  font-size: 13px;
  transition: background 0.1s;
  cursor: pointer;
}

.subRow:hover {
  background: #f3f4f6;
}
.subRow:last-child {
  border-bottom: none;
}

.subSectionBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--sg-blue-badge-bg);
  color: var(--sg-blue-badge-text);
  font-size: 10.5px;
  font-weight: 700;
}

.typeBadge {
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--sg-row-separator);
  color: var(--sg-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.scrollHint {
  min-height: 24px;
  padding: 5px 16px;
  background: var(--sg-bg-alt-row);
  text-align: center;
  font-size: 10px;
  color: var(--sg-text-disabled);
  border-top: 1px solid #eef0f4;
}

/* ── Empty state ── */
.empty {
  text-align: center;
  padding: 64px 24px;
  color: var(--sg-text-placeholder);
  font-size: 15px;
}
```

---

## 10. Day Dots: `DayDots.tsx`

Small colored badges showing which days of the week a course meets (M, Tu, W, Th, F). Active days are dark, inactive are light.

```tsx
// frontend/src/components/Catalog/DayDots.tsx
const DAY_LABELS = ['M', 'Tu', 'W', 'Th', 'F'];

export default function DayDots({ days }) {
  return (
    <div className={styles.container}>
      {DAY_LABELS.map((d) => (
        <span
          key={d}
          className={clsx(
            styles.dot,
            days[d] ? styles.active : styles.inactive,
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}
```

### DayDots CSS (`DayDots.module.css`)

```css
.container {
  display: flex;
  gap: 1px;
}

.dot {
  width: 17px;
  height: 15px;
  border-radius: 3px;
  font-size: 8.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.active {
  background: var(--sg-day-dot-active);
  color: var(--sg-bg-white);
}

.inactive {
  background: var(--sg-day-dot-inactive-bg);
  color: var(--sg-text-very-light);
}
```

---

## 11. Seats Display: `SeatsDisplay.tsx`

Shows remaining seats with color-coded status. Default variant shows "X left" text; subrow variant adds a progress bar.

```tsx
// frontend/src/components/Catalog/SeatsDisplay.tsx
export default function SeatsDisplay({
  enrolled,
  capacity,
  variant = 'default',
}) {
  if (enrolled === null || capacity === null || capacity <= 0) return null;
  const availableSeats = Math.max(capacity - enrolled, 0);
  const status = seatsColor(enrolled, capacity);
  const availablePct = Math.min((availableSeats / capacity) * 100, 100);

  if (variant === 'subrow') {
    return (
      <div className={clsx(styles.container, styles.subrow)}>
        <span className={clsx(styles.text, textClass[status])}>
          {availableSeats}/{capacity}
        </span>
        <div className={styles.bar}>
          <div
            className={clsx(styles.barFill, barClass[status])}
            style={{ width: `${availablePct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <span className={styles.text}>{availableSeats} left</span>
    </div>
  );
}
```

### SeatsDisplay CSS (`SeatsDisplay.module.css`)

```css
.container {
  display: flex;
  align-items: center;
  width: 100%;
}

.text {
  font-size: 12.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--sg-text-secondary);
  white-space: nowrap;
}

.subrow {
  --seat-bar-slot: 48px;
  display: grid;
  grid-template-columns: max-content var(--seat-bar-slot);
  column-gap: 8px;
  width: max-content;
}

.subrow .text {
  font-size: 11.5px;
  font-weight: 600;
  text-align: right;
}

.critical {
  color: #e24b4a;
}
.low {
  color: #d85a30;
}
.medium {
  color: #eda100;
}
.high {
  color: #1d9e75;
}
.available {
  color: #639922;
}

.bar {
  width: var(--seat-bar-slot);
  height: 4px;
  border-radius: 2px;
  background: #eef0f4;
  overflow: hidden;
}

.barFill {
  height: 100%;
  border-radius: 2px;
}
.barCritical {
  background: #e24b4a;
}
.barLow {
  background: #d85a30;
}
.barMedium {
  background: #eda100;
}
.barHigh {
  background: #1d9e75;
}
.barAvailable {
  background: #639922;
}
```

---

## 12. Worksheet Toggle Button: `WorksheetToggleButton.tsx`

The blue "+" button in each course row. Adds/removes a course from the user's worksheet. Animates between a "+" and a "−" state.

```tsx
// frontend/src/components/Worksheet/WorksheetToggleControls.tsx

function PlusMinusGlyph() {
  return (
    <>
      <span
        className={clsx(styles.toggleButtonBar, styles.toggleButtonBarH)}
        aria-hidden="true"
      />
      <span
        className={clsx(styles.toggleButtonBar, styles.toggleButtonBarV)}
        aria-hidden="true"
      />
    </>
  );
}

export function AddWorksheetButton({
  added,
  disabled,
  ariaLabel,
  className,
  onClick,
}) {
  return (
    <Button
      variant="toggle"
      className={clsx(
        className,
        styles.toggleButton,
        added && styles.isAdded,
        disabled && styles.disabledButton,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <PlusMinusGlyph />
    </Button>
  );
}
```

### WorksheetToggleControls CSS (`WorksheetToggleControls.module.css`)

```css
.toggleButton {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0 !important;
  border-radius: 8px;
  background: transparent !important;
  cursor: pointer;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.15s ease;
}

.toggleButton:hover {
  background: rgb(0 0 0 / 4%) !important;
}

.toggleButtonBar {
  position: absolute;
  display: block;
  border-radius: 1.5px;
  background: #4a6cf7;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.25s ease;
}

.toggleButtonBarH {
  width: 16px;
  height: 2.5px;
}
.toggleButtonBarV {
  width: 2.5px;
  height: 16px;
}

.isAdded {
  transform: rotate(180deg);
}
.isAdded .toggleButtonBarV {
  transform: scaleY(0);
}
.isAdded .toggleButtonBar {
  background: #e24b4a;
}

.disabledButton {
  cursor: not-allowed !important;
  background-color: transparent !important;
}

.disabledButton .toggleButtonBar {
  background: var(--color-icon-focus);
}
```

---

## 13. Typography Primitives: `Typography.tsx`

Shared styled primitives used across the page: `SurfaceComponent` (themed container), `TextComponent` (themed text), `Input` (themed form input).

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

export const Input = forwardRef(({ className, ...props }, ref) => (
  <FormControl {...props} ref={ref} className={clsx(styles.input, className)} />
));
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
.input:focus {
  background-color: var(--color-select);
}
```

---

## Data Model Summary

A `CatalogListing` (the item in each row) contains:

- `crn: number` — unique section identifier
- `course_code: string` — e.g. "ANAR 144"
- `course.season_code: string` — e.g. "S126"
- `course.title: string` — e.g. "Pharaohs, Mummies, and Pyramids"
- `course.same_course_id: number` — groups cross-listed sections
- `course.section: string` — e.g. "A00"
- `course.course_professors: [{professor: {name: string}}]` — instructor names
- `course.course_meetings: [{start_time, end_time, location: {building: {code}, room}}]`
- `course.ucsd_calendar?: object` — UCSD-specific: section_id, section_code, meeting_type, enrolled, capacity, meetings with days/time/building/room

A `DayFlags` (for DayDots) is:

- `M, Tu, W, Th, F, Sa, Su: boolean`

A `CatalogSortKey` is: `'code' | 'title' | 'term' | 'meets'`

A `SeatsStatus` is: `'critical' | 'low' | 'medium' | 'high' | 'available'`

- critical: <25% available (red #e24b4a)
- low: 25-50% (orange #d85a30)
- medium: 50-75% (yellow #eda100)
- high: 75-90% (green #1d9e75)
- available: >90% (green #639922)

---

## Design Tokens (CSS Variables)

The app uses CSS custom properties for theming. All tokens used by the catalog page:

### Brand / Primary

- `--sg-primary: #1a56db` — primary accent (links, active states, sort arrows)
- `--sg-primary-hover: #1548b8` — primary hover
- `--sg-primary-chip-bg: #eef3ff` — filter chip background
- `--sg-blue-badge-bg: #dbeafe` — badge/pill backgrounds (section count, sub-section)
- `--sg-blue-badge-text: #1e40af` — badge text

### Text

- `--sg-text-primary: #1a1a2e` — course code, primary headings
- `--sg-text-secondary: #33354d` — title text, time text
- `--sg-text-tertiary: #4a4d68` — dropdown labels
- `--sg-text-muted: #5a5d7a` — instructor names, location
- `--sg-text-placeholder: #8b8fa3` — header labels, updated timestamp
- `--sg-text-light: #9a9db4` — summary text in expanded rows
- `--sg-text-disabled: #b0b3be` — scroll hint
- `--sg-text-very-light: #c5c8d6` — inactive day dots

### Backgrounds

- `--sg-bg-white: #fff` — page/header/dropdown backgrounds
- `--sg-bg-alt-row: #fafbfc` — alternating row stripes
- `--sg-bg-input: #f8f9fb` — dropdown hover/open state

### Borders

- `--sg-border: #e8e9ef` — header bottom border
- `--sg-border-light: #dcdee6` — dropdown borders
- `--sg-row-separator: #f0f1f5` — row divider lines
- `--sg-day-dot-active: #334155` — active day badge
- `--sg-day-dot-inactive-bg: #f0f1f5` — inactive day badge

### Status

- `--sg-danger-red: #e8446a` — reset button
- `--sg-danger-red-hover: #d63a5e` — reset button hover

### Logo

- `--sg-logo-sun: #0e9ae9` — "Sun" part (blue)
- `--sg-logo-grid: #182b50` — "Grid" part (dark navy)

### Shadows

- `--sg-shadow-expanded: 0 0 0 1px #e0e2e8, 0 2px 8px rgb(0 0 0 / 4%)` — expanded row group

### Typography

- `--font-family-sans-serif: 'Inter', system-ui, -apple-system, sans-serif`
- `--font-family-logo: 'Cormorant Garamond', serif`

### Layout

- `--height-navbar: 72px`
- `--color-surface-hover: #f4f6fa` — row hover background

---

## Interaction Patterns

- **Sort**: Clicking a column header sort arrow toggles ascending/descending. Active sort key shows ▼ (asc) or ▲ (desc). Sort indicator is always `--sg-primary` blue.
- **Filter dropdown**: Click to open, items have checkboxes. Multi-select for Subject (searchable) and Term; single-select toggle for Course Level. Dropdown animates in with `popover-fade-in` (0.14s ease-out, slides up 6px).
- **Filter chips**: Active filters appear as blue rounded pills. Each has an × close button that removes that filter. The "Reset" button (red) clears all filters.
- **Row click**: Clicking a course row opens a course detail modal (URL param `course-modal`).
- **Add to worksheet**: Blue "+" icon in the leftmost column. CSS animates the vertical bar to `scaleY(0)` when added (forming a "−"), turns red. Uses `cubic-bezier(0.34, 1.56, 0.64, 1)` spring animation on transform.
- **Expandable rows**: Multi-section courses show a "N sections ▼" badge instead of a section code. Clicking the code cell expands to show sub-rows (max 3 visible, then scroll). Expanded group has `--sg-shadow-expanded` box-shadow.
- **Row hover**: `background: var(--color-surface-hover)` on hover with 0.1s transition.
- **Virtualization**: Only visible rows (plus overscan of 8) are rendered. Binary-search windowing for scroll performance.
- **Horizontal scroll**: On narrow viewports, a fixed-bottom scrollbar appears when the SEATS column is clipped.
- **Updated label**: Shows "Updated today" or relative time ("Updated 3 hrs ago") with a clock icon.
