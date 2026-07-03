import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import {
  SavedWorksheetMenuView,
  countCoursesWithFinals,
} from './NavbarWorksheetSearch';
import { useWorksheetSeasonCodes } from './SeasonDropdown';
import SegmentedControl from './SegmentedControl';
import WorksheetNumDropdown from './WorksheetNumberDropdown';
import { isLegacyUserInfo } from '../../queries/api';
import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import DarkModeButton from '../Navbar/DarkModeButton';
import MeDropdown from '../Navbar/MeDropdown';
import styles from './WorksheetMobileMenu.module.css';

/**
 * The worksheet page's mobile hamburger menu from the finalized SunGrid
 * calendar design: worksheet selector + profile on top, then full-width
 * View and Weeks segmented switches, then the Session list.
 */
export default function WorksheetMobileMenu({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const {
    user,
    courses,
    worksheetView,
    changeWorksheetView,
    calendarMode,
    setCalendarMode,
    viewedSeason,
    changeViewedSeason,
    activeSavedWorksheet,
    savedWorksheetSummaries,
    savedWorksheetListStatus,
    selectSavedWorksheet,
    createBlankSavedWorksheetForTerm,
    renameSavedWorksheet,
    deleteSavedWorksheet,
    ensureMainSavedWorksheetForTerm,
  } = useStore(
    useShallow((state) => ({
      user: state.user,
      courses: state.courses,
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      calendarMode: state.calendarMode,
      setCalendarMode: state.setCalendarMode,
      viewedSeason: state.viewedSeason,
      changeViewedSeason: state.changeViewedSeason,
      activeSavedWorksheet: state.activeSavedWorksheet,
      savedWorksheetSummaries: state.savedWorksheetSummaries,
      savedWorksheetListStatus: state.savedWorksheetListStatus,
      selectSavedWorksheet: state.selectSavedWorksheet,
      createBlankSavedWorksheetForTerm: state.createBlankSavedWorksheetForTerm,
      renameSavedWorksheet: state.renameSavedWorksheet,
      deleteSavedWorksheet: state.deleteSavedWorksheet,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
    })),
  );
  const seasonCodes = useWorksheetSeasonCodes();
  const [worksheetMenuOpen, setWorksheetMenuOpen] = useState(false);

  const hasLegacyWorksheetAccount = isLegacyUserInfo(user);
  const hasSavedWorksheetAccount = Boolean(user && !hasLegacyWorksheetAccount);
  const finalsCount = useMemo(() => countCoursesWithFinals(courses), [courses]);
  const visibleView = worksheetView === 'list' ? 'list' : 'calendar';

  return (
    <div className={styles.menu}>
      <div className={styles.topRow}>
        {hasSavedWorksheetAccount && activeSavedWorksheet ? (
          <div className={styles.worksheetRoot}>
            <button
              type="button"
              className={styles.worksheetToggle}
              onClick={() => setWorksheetMenuOpen((x) => !x)}
              aria-expanded={worksheetMenuOpen}
            >
              <span className={styles.worksheetStar} aria-hidden="true">
                ★
              </span>
              <span className={styles.worksheetName}>
                {activeSavedWorksheet.name}
              </span>
              <svg
                width="9"
                height="5"
                viewBox="0 0 10 6"
                fill="none"
                className={styles.worksheetChevron}
                data-open={worksheetMenuOpen || undefined}
                aria-hidden="true"
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {worksheetMenuOpen && (
              <div className={styles.worksheetMenuPopover}>
                <SavedWorksheetMenuView
                  term={viewedSeason}
                  activeWorksheetId={activeSavedWorksheet.id}
                  savedWorksheetSummaries={savedWorksheetSummaries}
                  onSelectSavedWorksheet={async (id) => {
                    const ok = await selectSavedWorksheet(id);
                    setWorksheetMenuOpen(false);
                    return ok;
                  }}
                  onCreateBlankSavedWorksheet={() =>
                    createBlankSavedWorksheetForTerm(viewedSeason)
                  }
                  onRenameSavedWorksheet={renameSavedWorksheet}
                  onDeleteSavedWorksheet={deleteSavedWorksheet}
                  isCreating={savedWorksheetListStatus === 'loading'}
                />
              </div>
            )}
          </div>
        ) : hasLegacyWorksheetAccount ? (
          <WorksheetNumDropdown mobile />
        ) : (
          <a href="/login" className={styles.signInButton}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign in
          </a>
        )}
        <div className={styles.spacer} />
        <DarkModeButton className={styles.settingsBtn} />
        <MeDropdown />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>View</div>
        <SegmentedControl
          fullWidth
          value={visibleView}
          onChange={changeWorksheetView}
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>

      <div className={styles.sectionWide}>
        <div className={styles.sectionLabel}>Weeks</div>
        <SegmentedControl
          fullWidth
          value={calendarMode}
          onChange={setCalendarMode}
          options={[
            { value: 'week', label: 'Regular' },
            {
              value: 'finals',
              label: (
                <>
                  Finals
                  {calendarMode === 'finals' && finalsCount > 0 && (
                    <span className={styles.finalsBadge}>{finalsCount}</span>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>

      <div className={styles.sectionLabel}>Session</div>
      <div className={styles.sessionList}>
        {seasonCodes.map((season) => {
          const isActive = season === viewedSeason;
          return (
            <button
              key={season}
              type="button"
              className={clsx(
                styles.sessionRow,
                isActive && styles.sessionRowActive,
              )}
              onClick={() => {
                if (hasSavedWorksheetAccount)
                  void ensureMainSavedWorksheetForTerm(season);
                else changeViewedSeason(season);
                onClose();
              }}
            >
              <span className={styles.sessionLabel}>
                {toSeasonString(season)}
              </span>
              {isActive && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#185fa5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
