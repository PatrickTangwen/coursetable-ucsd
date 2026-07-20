import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { COURSE_TYPES } from './FilterBar';
import { useCoursePlanningCatalog } from '../../hooks/useCoursePlanning';
import {
  buildCatalogListAdvancedFilterReset,
  extractCatalogSubjects,
} from '../../search/catalogListFilters';
import { defaultFilters, seasonsOptions } from '../../search/searchConstants';
import type { Option } from '../../search/searchTypes';
import { useStore } from '../../store';
import { formatSubjectLabel } from '../../utilities/subjectLabels';
import BottomSheet from '../BottomSheet';
import styles from './MobileFilterSheet.module.css';

type FilterView = 'main' | 'subject' | 'courseType' | 'term';

interface PickerConfig {
  title: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  toggle: (v: string) => void;
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function summarize(labels: string[]): string {
  if (labels.length === 0) return 'Any';
  if (labels.length === 1) return labels[0]!;
  return `${labels.length} selected`;
}

function CategoryRow({
  label,
  display,
  onOpen,
}: {
  readonly label: string;
  readonly display: string;
  readonly onOpen: () => void;
}) {
  return (
    <button type="button" className={styles.categoryRow} onClick={onOpen}>
      <span className={styles.categoryLabel}>{label}</span>
      <span className={styles.categoryValue}>
        {display}
        <ChevronRightIcon />
      </span>
    </button>
  );
}

export default function MobileFilterSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const {
    selectedSubjects,
    selectedSeasons,
    setSearchFilter,
    patchSearchFilters,
    typeFilters,
    toggleTypeFilter,
    clearTypeFilters,
  } = useStore(
    useShallow((s) => ({
      selectedSubjects: s.searchFilters.selectSubjects as Option[],
      selectedSeasons: s.searchFilters.selectSeasons,
      setSearchFilter: s.setSearchFilter,
      patchSearchFilters: s.patchSearchFilters,
      typeFilters: s.catalogTypeFilters,
      toggleTypeFilter: s.toggleCatalogTypeFilter,
      clearTypeFilters: s.clearCatalogTypeFilters,
    })),
  );
  const { courses } = useCoursePlanningCatalog();

  const [view, setView] = useState<FilterView>('main');
  const [query, setQuery] = useState('');

  // Reopening always starts from the category list
  useEffect(() => {
    if (open) {
      setView('main');
      setQuery('');
    }
  }, [open]);

  const subjectOptions = useMemo(
    () =>
      extractCatalogSubjects(courses, selectedSeasons).map((s) => ({
        value: s,
        label: formatSubjectLabel(s),
      })),
    [courses, selectedSeasons],
  );

  const toggleSubject = useCallback(
    (v: string) => {
      const isSelected = selectedSubjects.some((s) => s.value === v);
      setSearchFilter(
        'selectSubjects',
        isSelected
          ? selectedSubjects.filter((s) => s.value !== v)
          : [...selectedSubjects, { value: v, label: formatSubjectLabel(v) }],
      );
    },
    [selectedSubjects, setSearchFilter],
  );

  const toggleTerm = useCallback(
    (v: string) => {
      const isSelected = selectedSeasons.some((s) => s.value === v);
      const next = seasonsOptions.filter((o) =>
        o.value === v
          ? !isSelected
          : selectedSeasons.some((s) => s.value === o.value),
      );
      setSearchFilter('selectSeasons', next);
    },
    [selectedSeasons, setSearchFilter],
  );

  const resetAll = useCallback(() => {
    setSearchFilter('selectSubjects', []);
    setSearchFilter('selectSeasons', defaultFilters.selectSeasons);
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
    clearTypeFilters();
  }, [setSearchFilter, patchSearchFilters, clearTypeFilters]);

  const returnToMainView = useCallback(() => {
    setView('main');
    setQuery('');
  }, []);

  const pickers: { [K in Exclude<FilterView, 'main'>]: PickerConfig } = {
    subject: {
      title: 'Subject',
      options: subjectOptions,
      selected: selectedSubjects.map((s) => s.value),
      toggle: toggleSubject,
    },
    courseType: {
      title: 'Course Type',
      options: COURSE_TYPES.map((t) => ({ value: t.value, label: t.label })),
      selected: typeFilters,
      toggle: toggleTypeFilter,
    },
    term: {
      title: 'Term',
      options: seasonsOptions,
      selected: selectedSeasons.map((s) => s.value),
      toggle: toggleTerm,
    },
  };

  const picker = view === 'main' ? null : pickers[view];
  const trimmedQuery = query.trim().toLowerCase();
  const visibleOptions =
    picker?.options.filter(
      (o) => !trimmedQuery || o.label.toLowerCase().includes(trimmedQuery),
    ) ?? [];

  return (
    <BottomSheet open={open} onClose={onClose} className={styles.filterSheet}>
      {view === 'main' ? (
        <>
          <div className={styles.mainHeader}>
            <span className={styles.mainTitle}>Filters</span>
            <button
              type="button"
              className={styles.pickerActionBtn}
              onClick={onClose}
            >
              Done
            </button>
          </div>

          <div className={styles.categoryList}>
            <CategoryRow
              label="Subject"
              display={summarize(selectedSubjects.map((s) => s.label))}
              onOpen={() => setView('subject')}
            />
            <CategoryRow
              label="Course Type"
              display={summarize(
                COURSE_TYPES.filter((t) => typeFilters.includes(t.value)).map(
                  (t) => t.label,
                ),
              )}
              onOpen={() => setView('courseType')}
            />
            <CategoryRow
              label="Term"
              display={summarize(selectedSeasons.map((s) => s.label))}
              onOpen={() => setView('term')}
            />
          </div>

          <div className={styles.mainFooter}>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={resetAll}
            >
              Reset
            </button>
            <button type="button" className={styles.applyBtn} onClick={onClose}>
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
                className={styles.backBtn}
                onClick={returnToMainView}
                aria-label="Back"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className={styles.pickerTitle}>{picker!.title}</span>
            </div>
            <button
              type="button"
              className={styles.pickerActionBtn}
              onClick={returnToMainView}
            >
              Done
            </button>
          </div>

          <div className={styles.pickerSearch}>
            <div className={styles.pickerSearchBox}>
              <span className={styles.pickerSearchIcon}>
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className={styles.pickerSearchInput}
              />
            </div>
          </div>

          <div className={styles.optionList}>
            {visibleOptions.map((o) => {
              const selected = picker!.selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  className={clsx(
                    styles.optionRow,
                    selected && styles.optionRowSelected,
                  )}
                  onClick={() => picker!.toggle(o.value)}
                >
                  <span
                    className={clsx(
                      styles.checkbox,
                      selected && styles.checkboxSelected,
                    )}
                  >
                    {selected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 12l5 5L20 6" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={clsx(
                      styles.optionLabel,
                      selected && styles.optionLabelSelected,
                    )}
                  >
                    {o.label}
                  </span>
                </button>
              );
            })}
            {visibleOptions.length === 0 && (
              <div className={styles.emptyState}>No matches</div>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
