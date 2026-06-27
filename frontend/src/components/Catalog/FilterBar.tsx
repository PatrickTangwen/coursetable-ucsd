import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DropdownMenu } from './DropdownMenu';
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
import { formatSubjectLabel } from '../../utilities/subjectLabels';
import styles from './FilterBar.module.css';

const COURSE_LEVELS = [
  { value: 'lower', label: 'Lower Division', range: [1, 99] },
  { value: 'upper', label: 'Upper Division', range: [100, 199] },
  { value: 'graduate', label: 'Graduate', range: [200, 999] },
] as const;

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

  const subjectOptions = subjects.map((s) => ({
    value: s,
    label: formatSubjectLabel(s),
  }));

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
          { value: v, label: formatSubjectLabel(v) },
        ]);
      }
    },
    [selectedSubjects, setSearchFilter],
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
  const termChipLabel =
    selectedSeasons.length === 1
      ? selectedSeasons[0]!.label
      : `Terms: ${selectedSeasons.map((season) => season.value).join(', ')}`;

  return (
    <div className={styles.container}>
      <DropdownMenu
        label="Subject"
        displayLabel={subjectDisplayLabel}
        options={subjectOptions}
        selectedValues={selectedSubjects.map((s) => s.value)}
        onToggle={handleSubjectToggle}
        searchable
        searchPlaceholder="All subjects"
      />
      <DropdownMenu
        label="Course Level"
        options={COURSE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        selectedValues={levelFilter === null ? [] : [levelFilter]}
        onToggle={handleLevelToggle}
      />
      <DropdownMenu
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
