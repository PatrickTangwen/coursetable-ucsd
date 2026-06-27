import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import { useFerry } from '../../hooks/useFerry';
import type { Season } from '../../queries/graphql-types';
import {
  buildCatalogListAdvancedFilterReset,
  countCatalogListAdvancedFilters,
} from '../../search/catalogListFilters';
import { defaultFilters, seasonsOptions } from '../../search/searchConstants';
import type { Option } from '../../search/searchTypes';
import { useStore } from '../../store';
import {
  getCatalogLastUpdated,
  getCatalogStalenessLabel,
  toRelativeUpdateTime,
} from '../../utilities/catalogFreshness';
import styles from './FilterBar.module.css';

const COURSE_LEVELS = [
  { value: 'lower', label: 'Lower Division', range: [1, 99] },
  { value: 'upper', label: 'Upper Division', range: [100, 199] },
  { value: 'graduate', label: 'Graduate', range: [200, 999] },
] as const;

function DropdownChevron() {
  return (
    <svg className={styles.chevronSvg} viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M2 3.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function Dropdown({
  label,
  displayLabel,
  hoverTitle,
  options,
  selectedValues,
  onToggle,
  onApply,
}: {
  readonly label: string;
  readonly displayLabel?: string;
  readonly hoverTitle?: string;
  readonly options: { value: string; label: string }[];
  readonly selectedValues: string[];
  readonly onToggle: (v: string) => void;
  readonly onApply?: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftValues, setDraftValues] = useState(selectedValues);
  const ref = useRef<HTMLDivElement>(null);
  const usesApply = onApply !== undefined;
  const activeValues = usesApply ? draftValues : selectedValues;

  useEffect(() => {
    if (!open) return undefined;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (open) setDraftValues(selectedValues);
  }, [open, selectedValues]);

  const toggleValue = useCallback(
    (value: string) => {
      if (!usesApply) {
        onToggle(value);
        return;
      }
      setDraftValues((current) =>
        current.includes(value)
          ? current.filter((selected) => selected !== value)
          : [...current, value],
      );
    },
    [onToggle, usesApply],
  );

  const draftChanged =
    draftValues.length !== selectedValues.length ||
    draftValues.some((value) => !selectedValues.includes(value));

  return (
    <div className={styles.dropdownWrapper} ref={ref}>
      <button
        type="button"
        className={clsx(styles.dropdown, open && styles.dropdownOpen)}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={hoverTitle}
      >
        {displayLabel ?? label}
        <DropdownChevron />
      </button>
      {open && (
        <div className={styles.dropdownMenu} role="menu">
          {usesApply && (
            <div className={styles.dropdownSummary}>
              {draftValues.length > 0
                ? `Selected: ${draftValues.join(', ')}`
                : 'No subjects selected'}
            </div>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(
                styles.dropdownItem,
                activeValues.includes(opt.value) && styles.dropdownItemActive,
              )}
              role="menuitemcheckbox"
              aria-checked={activeValues.includes(opt.value)}
              onClick={() => toggleValue(opt.value)}
            >
              <span
                className={clsx(
                  styles.checkbox,
                  activeValues.includes(opt.value) && styles.checkboxActive,
                )}
                aria-hidden="true"
              >
                {activeValues.includes(opt.value) && (
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
              <span className={styles.dropdownItemLabel}>{opt.label}</span>
            </button>
          ))}
          {usesApply && (
            <div className={styles.dropdownActions}>
              <button
                type="button"
                className={styles.dropdownApply}
                disabled={!draftChanged}
                onClick={() => {
                  onApply(draftValues);
                  setOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  readonly label: string;
  readonly onRemove: () => void;
}) {
  return (
    <span className={styles.chip}>
      {label}
      <button
        type="button"
        className={styles.chipClose}
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

function UpdatedLabel({ season }: { readonly season: Season | null }) {
  const { courses } = useFerry();
  const lastUpdated = getCatalogLastUpdated(courses);
  const label = season
    ? getCatalogStalenessLabel(courses, season)
    : `Updated ${toRelativeUpdateTime(lastUpdated)} ago`;
  return (
    <div className={styles.updated}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 13 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="6.5" cy="6.5" r="5" />
        <polyline points="6.5,3.5 6.5,6.5 8.5,8" />
      </svg>
      <time title={lastUpdated.toString()} dateTime={lastUpdated.toISOString()}>
        {label}
      </time>
    </div>
  );
}

export default function FilterBar({
  subjects,
}: {
  readonly subjects: string[];
}) {
  const {
    selectedSubjects,
    selectedSeasons,
    searchFilters,
    setSearchFilter,
    patchSearchFilters,
    levelFilter,
    setLevelFilter,
  } = useStore(
    useShallow((s) => ({
      selectedSubjects: s.searchFilters.selectSubjects as Option[],
      selectedSeasons: s.searchFilters.selectSeasons as Option[],
      searchFilters: s.searchFilters,
      setSearchFilter: s.setSearchFilter,
      patchSearchFilters: s.patchSearchFilters,
      levelFilter: s.catalogLevelFilter,
      setLevelFilter: s.setCatalogLevelFilter,
    })),
  );

  const subjectOptions = subjects.map((s) => ({ value: s, label: s }));

  const handleSubjectToggle = useCallback(
    (v: string) => {
      const current = selectedSubjects.map((s) => s.value);
      if (current.includes(v)) {
        setSearchFilter(
          'selectSubjects',
          selectedSubjects.filter((s) => s.value !== v),
        );
      } else {
        setSearchFilter('selectSubjects', [
          ...selectedSubjects,
          { value: v, label: v },
        ]);
      }
    },
    [selectedSubjects, setSearchFilter],
  );

  const handleSubjectApply = useCallback(
    (values: string[]) => {
      const selected = values.map((value) => ({ value, label: value }));
      setSearchFilter('selectSubjects', selected);
    },
    [setSearchFilter],
  );

  const handleLevelToggle = useCallback(
    (v: string) => {
      setLevelFilter(levelFilter === v ? null : v);
    },
    [levelFilter, setLevelFilter],
  );

  const handleTermToggle = useCallback(
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

  const advancedFilterCount =
    countCatalogListAdvancedFilters(searchFilters) + (levelFilter ? 1 : 0);
  const hasActiveFilters =
    selectedSubjects.length > 0 ||
    selectedSeasons.length > 0 ||
    advancedFilterCount > 0;

  const resetAll = useCallback(() => {
    setSearchFilter('selectSubjects', []);
    setSearchFilter('selectSeasons', defaultFilters.selectSeasons);
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
    setLevelFilter(null);
  }, [patchSearchFilters, setSearchFilter, setLevelFilter]);

  const resetAdvancedFilters = useCallback(() => {
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
    setLevelFilter(null);
  }, [patchSearchFilters, setLevelFilter]);

  const subjectDisplayLabel =
    selectedSubjects.length > 0
      ? `Subject (${selectedSubjects.length})`
      : undefined;
  const subjectHoverTitle =
    selectedSubjects.length > 0
      ? `Selected subjects: ${selectedSubjects.map((s) => s.label).join(', ')}`
      : 'No subjects selected';
  const termChipLabel =
    selectedSeasons.length === 1
      ? selectedSeasons[0]!.label
      : `Terms: ${selectedSeasons.map((season) => season.value).join(', ')}`;

  return (
    <div className={styles.container}>
      <Dropdown
        label="Subject"
        displayLabel={subjectDisplayLabel}
        hoverTitle={subjectHoverTitle}
        options={subjectOptions}
        selectedValues={selectedSubjects.map((s) => s.value)}
        onToggle={handleSubjectToggle}
        onApply={handleSubjectApply}
      />
      <Dropdown
        label="Course Level"
        options={COURSE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        selectedValues={levelFilter === null ? [] : [levelFilter]}
        onToggle={handleLevelToggle}
      />
      <Dropdown
        label="Term"
        options={seasonsOptions}
        selectedValues={selectedSeasons.map((s) => s.value)}
        onToggle={handleTermToggle}
      />

      {selectedSeasons.length > 0 && (
        <FilterChip
          label={termChipLabel}
          onRemove={() => setSearchFilter('selectSeasons', [])}
        />
      )}
      {selectedSubjects.map((s) => (
        <FilterChip
          key={s.value}
          label={s.label}
          onRemove={() =>
            setSearchFilter(
              'selectSubjects',
              selectedSubjects.filter((x) => x.value !== s.value),
            )
          }
        />
      ))}
      {advancedFilterCount > 0 && (
        <FilterChip
          label={`Advanced: ${advancedFilterCount}`}
          onRemove={resetAdvancedFilters}
        />
      )}

      {hasActiveFilters && (
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset
        </button>
      )}

      <div className={styles.spacer} />
      <UpdatedLabel
        season={
          selectedSeasons.length === 1
            ? (selectedSeasons[0]!.value as Season)
            : null
        }
      />
    </div>
  );
}

export { COURSE_LEVELS };
