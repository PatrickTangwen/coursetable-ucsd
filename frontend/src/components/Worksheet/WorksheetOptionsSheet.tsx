import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaMagnifyingGlass,
  FaXmark,
} from 'react-icons/fa6';
import { useShallow } from 'zustand/react/shallow';

import { countCoursesWithFinals } from './NavbarWorksheetSearch';
import { useWorksheetSeasonCodes } from './SeasonDropdown';
import SegmentedControl from './SegmentedControl';
import {
  applyWorksheetOptions,
  createWorksheetOptionsDraft,
  resetWorksheetOptionsDraft,
} from './worksheetOptionsState';
import { CUR_SEASON } from '../../config';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import BottomSheet from '../BottomSheet';
import styles from './WorksheetOptionsSheet.module.css';

type SheetView = 'main' | 'term';

export default function WorksheetOptionsSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
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
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
    })),
  );
  const seasonCodes = useWorksheetSeasonCodes();
  const [view, setView] = useState<SheetView>('main');
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const wasOpen = useRef(false);
  const [draft, setDraft] = useState(() =>
    createWorksheetOptionsDraft(worksheetView, calendarMode, viewedSeason),
  );

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    setDraft(
      createWorksheetOptionsDraft(worksheetView, calendarMode, viewedSeason),
    );
    setView('main');
    setQuery('');
    setApplying(false);
  }, [calendarMode, open, viewedSeason, worksheetView]);

  const finalsCount = useMemo(() => countCoursesWithFinals(courses), [courses]);
  const trimmedQuery = query.trim().toLowerCase();
  const visibleTerms = seasonCodes.filter((term) =>
    toSeasonString(term).toLowerCase().includes(trimmedQuery),
  );

  const handleReset = () => {
    const defaultTerm = seasonCodes.includes(CUR_SEASON)
      ? CUR_SEASON
      : (seasonCodes[0] ?? CUR_SEASON);
    setDraft(resetWorksheetOptionsDraft(defaultTerm));
  };

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const applied = await applyWorksheetOptions(
        draft,
        viewedSeason,
        Boolean(user),
        {
          changeWorksheetView,
          setCalendarMode,
          changeViewedSeason,
          ensureMainSavedWorksheetForTerm,
          getViewedSeason: () => useStore.getState().viewedSeason,
        },
      );
      if (applied) onClose();
    } finally {
      setApplying(false);
    }
  };

  const closeTermPicker = () => {
    setView('main');
    setQuery('');
  };

  const selectTerm = (term: Season) => {
    setDraft((current) => ({ ...current, term }));
    closeTermPicker();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      swipeToClose
      className={styles.optionsSheet}
    >
      {view === 'main' ? (
        <>
          <div className={styles.header}>
            <h2 className={styles.title}>Worksheet Options</h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close Worksheet options"
            >
              <FaXmark aria-hidden="true" />
            </button>
          </div>

          <div className={styles.content}>
            <section className={styles.optionSection}>
              <h3 className={styles.sectionLabel}>View</h3>
              <SegmentedControl
                fullWidth
                value={draft.view}
                onChange={(nextView) =>
                  setDraft((current) => ({ ...current, view: nextView }))
                }
                options={[
                  { value: 'calendar', label: 'Calendar' },
                  { value: 'list', label: 'List' },
                ]}
              />
            </section>

            <section className={styles.optionSection}>
              <h3 className={styles.sectionLabel}>Weeks</h3>
              <SegmentedControl
                fullWidth
                value={draft.weeks}
                onChange={(weeks) =>
                  setDraft((current) => ({ ...current, weeks }))
                }
                options={[
                  { value: 'week', label: 'Regular' },
                  {
                    value: 'finals',
                    label: (
                      <>
                        Finals
                        {draft.weeks === 'finals' && finalsCount > 0 && (
                          <span className={styles.finalsBadge}>
                            {finalsCount}
                          </span>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            </section>

            <button
              type="button"
              className={styles.termRow}
              onClick={() => setView('term')}
            >
              <span className={styles.termLabel}>Term</span>
              <span className={styles.termValue}>
                {toSeasonString(draft.term)}
                <FaChevronRight aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.applyButton}
              disabled={applying}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.pickerHeader}>
            <div className={styles.pickerHeaderLeft}>
              <button
                type="button"
                className={styles.backButton}
                onClick={closeTermPicker}
                aria-label="Back to Worksheet options"
              >
                <FaChevronLeft aria-hidden="true" />
              </button>
              <h2 className={styles.pickerTitle}>Term</h2>
            </div>
            <button
              type="button"
              className={styles.doneButton}
              onClick={closeTermPicker}
            >
              Done
            </button>
          </div>

          <div className={styles.searchArea}>
            <div className={styles.searchBox}>
              <FaMagnifyingGlass
                className={styles.searchIcon}
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search…"
                className={styles.searchInput}
                aria-label="Search terms"
              />
            </div>
          </div>

          <div className={styles.termList}>
            {visibleTerms.map((term) => {
              const selected = term === draft.term;
              return (
                <button
                  key={term}
                  type="button"
                  className={clsx(
                    styles.termOption,
                    selected && styles.termOptionSelected,
                  )}
                  onClick={() => selectTerm(term)}
                >
                  <span>{toSeasonString(term)}</span>
                  {selected && <FaCheck aria-hidden="true" />}
                </button>
              );
            })}
            {visibleTerms.length === 0 && (
              <div className={styles.emptyState}>No matches</div>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
