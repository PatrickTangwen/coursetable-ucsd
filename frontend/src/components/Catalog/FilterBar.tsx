import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DropdownMenu } from './DropdownMenu';
import SelectedFiltersMenu, {
  type SelectedFilterGroup,
} from './SelectedFiltersMenu';
import { useCoursePlanningCatalog } from '../../hooks/useCoursePlanning';
import type { Season } from '../../queries/graphql-types';
import {
  buildCatalogListAdvancedFilterReset,
  extractCatalogUnitOptions,
  getActiveCatalogListAdvancedFilterKeys,
} from '../../search/catalogListFilters';
import { toggleCatalogUnitSelection } from '../../search/catalogUnits';
import {
  defaultFilters,
  filterLabels,
  seasonsOptions,
} from '../../search/searchConstants';
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
  const value = parseCourseNumber(number);
  return value >= min && value <= max;
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

const DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
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
  const { courses } = useCoursePlanningCatalog();
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
    selectedDays,
    selectedUnits,
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
      selectedSeasons: s.searchFilters.selectSeasons,
      selectedDays: s.searchFilters.selectDays,
      selectedUnits: s.searchFilters.selectCredits,
      searchFilters: s.searchFilters,
      setSearchFilter: s.setSearchFilter,
      patchSearchFilters: s.patchSearchFilters,
      typeFilters: s.catalogTypeFilters,
      toggleTypeFilter: s.toggleCatalogTypeFilter,
      clearTypeFilters: s.clearCatalogTypeFilters,
    })),
  );
  const { courses } = useCoursePlanningCatalog();

  const subjectOptions = subjects.map((s) => ({
    value: s,
    label: formatSubjectLabel(s),
  }));
  const unitOptions = extractCatalogUnitOptions(courses, selectedSeasons);

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

  const handleDayToggle = useCallback(
    (v: string) => {
      const day = Number(v);
      const isSelected = selectedDays.some((option) => option.value === day);
      setSearchFilter(
        'selectDays',
        isSelected
          ? selectedDays.filter((option) => option.value !== day)
          : [
              ...selectedDays,
              {
                value: day,
                label:
                  DAY_OPTIONS.find((option) => option.value === day)?.label ??
                  v,
              },
            ],
      );
    },
    [selectedDays, setSearchFilter],
  );

  const handleUnitToggle = useCallback(
    (v: string) => {
      const value = Number(v);
      setSearchFilter(
        'selectCredits',
        toggleCatalogUnitSelection(selectedUnits, unitOptions, value),
      );
    },
    [selectedUnits, setSearchFilter, unitOptions],
  );

  const advancedFilterKeys =
    getActiveCatalogListAdvancedFilterKeys(searchFilters);
  const advancedFilterCount = advancedFilterKeys.length;
  const hasActiveFilters =
    selectedSubjects.length > 0 ||
    selectedSeasons.length > 0 ||
    selectedDays.length > 0 ||
    selectedUnits.length > 0 ||
    typeFilters.length > 0 ||
    advancedFilterCount > 0;

  const resetAll = useCallback(() => {
    setSearchFilter('selectSubjects', []);
    setSearchFilter('selectSeasons', defaultFilters.selectSeasons);
    setSearchFilter('selectDays', []);
    setSearchFilter('selectCredits', []);
    patchSearchFilters(buildCatalogListAdvancedFilterReset());
    clearTypeFilters();
  }, [patchSearchFilters, setSearchFilter, clearTypeFilters]);

  const removeAdvancedFilter = useCallback(
    (key: keyof typeof searchFilters) => {
      patchSearchFilters(buildCatalogListAdvancedFilterReset([key]));
    },
    [patchSearchFilters],
  );

  const selectedFilterGroups: SelectedFilterGroup[] = [
    {
      label: 'Terms',
      items: selectedSeasons.map((season) => ({
        id: season.value,
        label: season.label,
        onRemove: () => handleTermToggle(season.value),
      })),
    },
    {
      label: 'Subjects',
      items: selectedSubjects.map((subject) => ({
        id: subject.value,
        label: subject.label,
        onRemove: () =>
          setSearchFilter(
            'selectSubjects',
            selectedSubjects.filter((item) => item.value !== subject.value),
          ),
      })),
    },
    {
      label: 'Days',
      items: selectedDays.map((day) => ({
        id: String(day.value),
        label: day.label,
        onRemove: () => handleDayToggle(String(day.value)),
      })),
    },
    {
      label: 'Units',
      items: selectedUnits.map((unit) => ({
        id: String(unit.value),
        label: unit.label,
        onRemove: () => handleUnitToggle(String(unit.value)),
      })),
    },
    {
      label: 'Course types',
      items: COURSE_TYPES.filter((type) =>
        typeFilters.includes(type.value),
      ).map((type) => ({
        id: type.value,
        label: type.label,
        onRemove: () => toggleTypeFilter(type.value),
      })),
    },
    {
      label: 'Advanced filters',
      items: advancedFilterKeys.map((key) => ({
        id: key,
        label: filterLabels[key],
        onRemove: () => removeAdvancedFilter(key),
      })),
    },
  ].filter((group) => group.items.length > 0);
  const selectedFilterCount = selectedFilterGroups.reduce(
    (count, group) => count + group.items.length,
    0,
  );
  const collapseSelectedFilters = selectedFilterCount > 2;

  // On mobile the dropdowns/chips live in the filter bottom sheet (opened
  // from the navbar's Filters button); only the freshness label remains here.
  if (isMobile) {
    return (
      <div className={styles.mobileUpdatedRow}>
        <UpdatedLabel
          season={
            selectedSeasons.length === 1 ? selectedSeasons[0]!.value : null
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
        label="Units"
        displayLabel={
          selectedUnits.length > 0
            ? `Units (${selectedUnits.length})`
            : undefined
        }
        options={unitOptions.map((option) => ({
          value: String(option.value),
          label: option.label,
        }))}
        selectedValues={selectedUnits.map((unit) => String(unit.value))}
        onToggle={handleUnitToggle}
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
      <DropdownMenu
        label="Days"
        displayLabel={
          selectedDays.length > 0 ? `Days (${selectedDays.length})` : undefined
        }
        options={DAY_OPTIONS.map((day) => ({
          value: String(day.value),
          label: day.label,
        }))}
        selectedValues={selectedDays.map((day) => String(day.value))}
        onToggle={handleDayToggle}
      />

      {collapseSelectedFilters ? (
        <SelectedFiltersMenu groups={selectedFilterGroups} />
      ) : (
        selectedFilterGroups.flatMap((group) =>
          group.items.map((item) => (
            <FilterChip
              key={`${group.label}-${item.id}`}
              label={item.label}
              onRemove={item.onRemove}
            />
          )),
        )
      )}

      {hasActiveFilters && (
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset
        </button>
      )}

      <div className={styles.spacer} />
      <UpdatedLabel
        season={selectedSeasons.length === 1 ? selectedSeasons[0]!.value : null}
      />
    </div>
  );
}

export { COURSE_TYPES, DAY_OPTIONS };
