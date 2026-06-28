import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import styles from './DropdownMenu.module.css';

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
}: {
  readonly label: string;
  readonly displayLabel?: string;
  readonly options: { value: string; label: string }[];
  readonly selectedValues: string[];
  readonly onToggle: (v: string) => void;
  readonly closeOnToggle?: boolean;
  readonly showCheckbox?: boolean;
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
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(
                styles.dropdownItem,
                selectedValues.includes(opt.value) && styles.dropdownItemActive,
              )}
              role="menuitemcheckbox"
              aria-checked={selectedValues.includes(opt.value)}
              onClick={() => {
                onToggle(opt.value);
                if (closeOnToggle) setOpen(false);
              }}
            >
              {showCheckbox && (
                <span
                  className={clsx(
                    styles.checkbox,
                    selectedValues.includes(opt.value) && styles.checkboxActive,
                  )}
                  aria-hidden="true"
                >
                  {selectedValues.includes(opt.value) && (
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
          ))}
        </div>
      )}
    </div>
  );
}
