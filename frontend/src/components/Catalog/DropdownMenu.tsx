import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import styles from './DropdownMenu.module.css';

type DropdownMenuOption = {
  readonly value: string;
  readonly label: string;
};

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
}: {
  readonly label: string;
  readonly displayLabel?: string;
  readonly options: DropdownMenuOption[];
  readonly selectedValues: string[];
  readonly onToggle: (v: string) => void;
  readonly closeOnToggle?: boolean;
  readonly showCheckbox?: boolean;
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearchText = searchText.trim().toLowerCase();
  const visibleOptions = normalizedSearchText
    ? options.filter((opt) =>
        `${opt.value} ${opt.label}`
          .toLowerCase()
          .includes(normalizedSearchText),
      )
    : options;

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
    if (!open) setSearchText('');
  }, [open]);

  useEffect(() => {
    if (open && searchable) searchInputRef.current?.focus();
  }, [open, searchable]);

  return (
    <div className={styles.dropdownWrapper} ref={ref}>
      <button
        type="button"
        className={clsx(styles.dropdown, open && styles.dropdownOpen)}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
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
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`${label} search`}
                ref={searchInputRef}
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
                    aria-hidden="true"
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
          {visibleOptions.length === 0 && (
            <div className={styles.emptyState}>No options found</div>
          )}
        </div>
      )}
    </div>
  );
}
