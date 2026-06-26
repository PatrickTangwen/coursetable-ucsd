import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '../../store';
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
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: { value: string; label: string }[];
  readonly value: string | null;
  readonly onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.dropdownWrapper} ref={ref}>
      <button
        type="button"
        className={clsx(styles.dropdown, open && styles.dropdownOpen)}
        onClick={() => setOpen(!open)}
      >
        {selected ? selected.label : label}
        <DropdownChevron />
      </button>
      {open && (
        <div className={styles.dropdownMenu}>
          <button
            type="button"
            className={clsx(
              styles.dropdownItem,
              value === null && styles.dropdownItemActive,
            )}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            All
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(
                styles.dropdownItem,
                value === opt.value && styles.dropdownItemActive,
              )}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
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

export default function FilterBar({
  subjects,
}: {
  readonly subjects: string[];
}) {
  const { selectedSubjects, setSearchFilter, levelFilter, setLevelFilter } =
    useStore(
      useShallow((s) => ({
        selectedSubjects: s.searchFilters.selectSubjects as {
          value: string;
          label: string;
        }[],
        setSearchFilter: s.setSearchFilter,
        levelFilter: s.catalogLevelFilter,
        setLevelFilter: s.setCatalogLevelFilter,
      })),
    );

  const subjectOptions = subjects.map((s) => ({ value: s, label: s }));

  const handleSubjectChange = useCallback(
    (v: string | null) => {
      if (v === null) {
        setSearchFilter('selectSubjects', []);
      } else {
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
      }
    },
    [selectedSubjects, setSearchFilter],
  );

  const hasActiveFilters = selectedSubjects.length > 0 || levelFilter !== null;

  const resetAll = useCallback(() => {
    setSearchFilter('selectSubjects', []);
    setLevelFilter(null);
  }, [setSearchFilter, setLevelFilter]);

  const currentSubject =
    selectedSubjects.length === 1 ? selectedSubjects[0]!.value : null;

  return (
    <div className={styles.container}>
      <Dropdown
        label="Subject"
        options={subjectOptions}
        value={currentSubject}
        onChange={handleSubjectChange}
      />
      <Dropdown
        label="Course Level"
        options={COURSE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        value={levelFilter}
        onChange={setLevelFilter}
      />

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
      {levelFilter !== null && (
        <FilterChip
          label={
            COURSE_LEVELS.find((l) => l.value === levelFilter)?.label ??
            levelFilter
          }
          onRemove={() => setLevelFilter(null)}
        />
      )}

      {hasActiveFilters && (
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset
        </button>
      )}
    </div>
  );
}

export { COURSE_LEVELS };
