import { useMemo } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import { countCoursesWithFinals } from './NavbarWorksheetSearch';
import { SeasonDropdownMenu } from './SeasonDropdown';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import styles from './MobileWorksheetControls.module.css';

function CalendarViewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function FinalsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  );
}

/**
 * Mobile worksheet navbar controls. The term dropdown sits next to the logo
 * (mirroring the desktop navbar); View and Weeks live in a second navbar row
 * as mobile-native controls: an icon view toggle and a Finals chip.
 * Changes apply immediately.
 */
export function MobileWorksheetTermSelector() {
  const { user, changeViewedSeason, ensureMainSavedWorksheetForTerm } =
    useStore(
      useShallow((state) => ({
        user: state.user,
        changeViewedSeason: state.changeViewedSeason,
        ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      })),
    );

  const switchTerm = (term: Season) => {
    if (user) void ensureMainSavedWorksheetForTerm(term);
    else changeViewedSeason(term);
  };

  return <SeasonDropdownMenu onChange={switchTerm} />;
}

export function MobileWorksheetViewControls() {
  const {
    worksheetView,
    changeWorksheetView,
    calendarMode,
    setCalendarMode,
    courses,
  } = useStore(
    useShallow((state) => ({
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      calendarMode: state.calendarMode,
      setCalendarMode: state.setCalendarMode,
      courses: state.courses,
    })),
  );
  const finalsCount = useMemo(() => countCoursesWithFinals(courses), [courses]);
  const view = worksheetView === 'list' ? 'list' : 'calendar';
  const finals = calendarMode === 'finals';

  return (
    <div className={styles.controlsRow}>
      <div className={styles.viewToggle}>
        <span
          className={clsx(
            styles.viewPill,
            view === 'list' && styles.viewPillRight,
          )}
          aria-hidden="true"
        />
        <button
          type="button"
          className={clsx(
            styles.viewButton,
            view === 'calendar' && styles.viewButtonActive,
          )}
          aria-label="Calendar view"
          aria-pressed={view === 'calendar'}
          onClick={() => changeWorksheetView('calendar')}
        >
          <CalendarViewIcon />
        </button>
        <button
          type="button"
          className={clsx(
            styles.viewButton,
            view === 'list' && styles.viewButtonActive,
          )}
          aria-label="List view"
          aria-pressed={view === 'list'}
          onClick={() => changeWorksheetView('list')}
        >
          <ListViewIcon />
        </button>
      </div>
      {/* Finals week is a calendar-only concept; the chip toggles between
          regular weeks (off) and finals week (on). */}
      {view === 'calendar' && (
        <button
          type="button"
          className={clsx(styles.finalsChip, finals && styles.finalsChipActive)}
          aria-pressed={finals}
          onClick={() => setCalendarMode(finals ? 'week' : 'finals')}
        >
          <FinalsIcon />
          Finals
          {finals && finalsCount > 0 && (
            <span className={styles.finalsBadge}>{finalsCount}</span>
          )}
        </button>
      )}
    </div>
  );
}
