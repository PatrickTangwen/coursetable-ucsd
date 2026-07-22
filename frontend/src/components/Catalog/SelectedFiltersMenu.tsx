import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

import styles from './SelectedFiltersMenu.module.css';

export type SelectedFilterGroup = {
  readonly label: string;
  readonly items: {
    readonly id: string;
    readonly label: string;
    readonly onRemove: () => void;
  }[];
};

export default function SelectedFiltersMenu({
  groups,
}: {
  readonly groups: SelectedFilterGroup[];
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const itemCount = groups.reduce(
    (count, group) => count + group.items.length,
    0,
  );

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={clsx(styles.trigger, open && styles.triggerOpen)}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span>Advanced</span>
        <span className={styles.count}>{itemCount}</span>
        <svg className={styles.chevron} viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} id={menuId} role="menu">
          <div className={styles.menuHeader}>
            <span>Selected filters</span>
            <span>{itemCount}</span>
          </div>
          {groups.map((group) => (
            <section className={styles.group} key={group.label}>
              <div className={styles.groupLabel}>{group.label}</div>
              <div className={styles.items}>
                {group.items.map((item) => (
                  <div className={styles.item} key={item.id}>
                    <span className={styles.itemLabel} title={item.label}>
                      {item.label}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={item.onRemove}
                      aria-label={`Remove ${item.label} filter`}
                      role="menuitem"
                    >
                      <svg viewBox="0 0 11 11" aria-hidden="true">
                        <path
                          d="M2.5 2.5l6 6M8.5 2.5l-6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
