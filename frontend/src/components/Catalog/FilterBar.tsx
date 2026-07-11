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

function parseCourseNumber(number: string): number {
  const match = /\d+/u.exec(number);
  return match ? Number(match[0]) : 0;
}

function numberInRange(number: string, min: number, max: number): boolean {
  const num = parseCourseNumber(number);
  return num >= min && num <= max;
}

const COURSE_TYPES = [
  {
    value: 'lower',
    label: 'Lower Division',
    matches: (number: string) => numberInRange(number, 1, 99),
  },
  {
    value: 'upper',
    label: 'Upper Division',
    matches: (number: string) => numberInRange(number, 100, 199),
  },
  {
    value: 'graduate',
    label: 'Graduate',
    matches: (number: string) => numberInRange(number, 200, 999),
  },
  {
    // UCSD marks remote sections with an R suffix on the course number
    // (e.g. CSE 100R).
    value: 'remote',
    label: 'Remote',
    matches: (number: string) => number.trim().toUpperCase().endsWith('R'),
  },
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
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path
            d="M2.5 2.5l6 6M8.5 2.5l-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
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
    isMobile,
    selectedSubjects,
    selectedSeasons,
    searchFilters,
    setSearchFilter,
    patchSearchFilters,
    typeFilters,
    toggleTypeFilter,
    clearTypeFilters,
  } = useStore(
    useShallow((s) => ({
      isMobile: s.isMobile,
      selectedSubjects: s.searchFilters.selectSubjects as Option[],
      selectedSeasons: s.searchFilters.selectSeasons as Option[],
      searchFilters: s.searchFilters,
      setSearchFilter: s.setSearchFilter,
      patchSearchFilters: s.patchSearchFilters,
      typeFilters: s.catalogTypeFilters,
      toggleTypeFilter: s.toggleCatalogTypeFilter,
      clearTypeFilters: s.clearCatalogTypeFilters,
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

  const advancedFilterCount = countCatalogListAdvancedFilters(searchFilters);
  const hasActiveFilters =
    selectedSubjects.length > 0 ||
    selectedSeasons.length > 0 ||
    typeFilters.length > 0 ||
    advancedFilterCount > 0;

  const resetAll = useCallback(() => {
    setSearchFilter('selectSubjects', []);
    setSearchFilter('selectSeasons', defaultFilters.selectSeasons);
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
    clearTypeFilters();
  }, [patchSearchFilters, setSearchFilter, clearTypeFilters]);

  const resetAdvancedFilters = useCallback(() => {
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
  }, [patchSearchFilters]);

  // On mobile the dropdowns/chips live in the filter bottom sheet (opened
  // from the navbar's Filters button); only the freshness label remains here.
  if (isMobile) {
    return (
      <div className={styles.mobileUpdatedRow}>
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

  return (
    <div className={styles.container}>
      <DropdownMenu
        label="Subject"
        displayLabel={
          selectedSubjects.length > 0
            ? `Subject (${selectedSubjects.length})`
            : undefined
        }
        options={subjectOptions}
        selectedValues={selectedSubjects.map((s) => s.value)}
        onToggle={handleSubjectToggle}
        searchable
        searchPlaceholder="All subjects"
      />
      <DropdownMenu
        label="Course Type"
        displayLabel={
          typeFilters.length > 0
            ? `Course Type (${typeFilters.length})`
            : undefined
        }
        options={COURSE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        selectedValues={typeFilters}
        onToggle={toggleTypeFilter}
      />
      <DropdownMenu
        label="Term"
        displayLabel={
          selectedSeasons.length > 0
            ? `Term (${selectedSeasons.length})`
            : undefined
        }
        options={seasonsOptions}
        selectedValues={selectedSeasons.map((s) => s.value)}
        onToggle={handleTermToggle}
      />

      {selectedSeasons.map((s) => (
        <FilterChip
          key={s.value}
          label={s.label}
          onRemove={() => handleTermToggle(s.value)}
        />
      ))}
      {selectedSubjects.map((s) => (
        <FilterChip
          key={s.value}
          label={s.value}
          onRemove={() =>
            setSearchFilter(
              'selectSubjects',
              selectedSubjects.filter((x) => x.value !== s.value),
            )
          }
        />
      ))}
      {COURSE_TYPES.filter((t) => typeFilters.includes(t.value)).map((t) => (
        <FilterChip
          key={t.value}
          label={t.label}
          onRemove={() => toggleTypeFilter(t.value)}
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

export { COURSE_TYPES };
