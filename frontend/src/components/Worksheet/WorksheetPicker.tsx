import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import type { SavedWorksheet, SavedWorksheetSummary } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import styles from './WorksheetPicker.module.css';

export function useCloseOnOutsideClick(
  open: boolean,
  close: () => void,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, close]);
  return ref;
}

// The saved-worksheet selector from the finalized SunGrid calendar sidebar:
// "★ <name> ⌄" toggle opening a menu of the term's worksheets with rename /
// delete / create actions. Presentational; both the calendar sidebar and the
// list-view navbar wire it to the store.
export default function WorksheetPicker({
  variant = 'sidebar',
  viewedSeason,
  activeSavedWorksheet,
  savedWorksheetSummaries,
  selectSavedWorksheet,
  createBlankSavedWorksheetForTerm,
  renameSavedWorksheet,
  deleteSavedWorksheet,
  onOpenChange,
}: {
  readonly variant?: 'sidebar' | 'navbar';
  readonly viewedSeason: Season;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetSummaries: readonly SavedWorksheetSummary[];
  readonly selectSavedWorksheet: (id: number) => Promise<unknown>;
  readonly createBlankSavedWorksheetForTerm: (term: Season) => Promise<unknown>;
  readonly renameSavedWorksheet: (id: number, name: string) => Promise<unknown>;
  readonly deleteSavedWorksheet: (id: number) => Promise<unknown>;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const rootRef = useCloseOnOutsideClick(open, () => {
    setOpen(false);
    setEditingId(null);
  });

  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  if (!activeSavedWorksheet) return null;

  const termWorksheets = savedWorksheetSummaries
    .filter((summary) => summary.term === viewedSeason)
    .sort(
      (a, b) =>
        Number(b.isMain) - Number(a.isMain) || b.createdAt - a.createdAt,
    );

  const confirmRename = async () => {
    if (editingId === null) return;
    const name = editingName.trim();
    if (name) await renameSavedWorksheet(editingId, name);
    setEditingId(null);
    setEditingName('');
  };

  const renderRow = (summary: SavedWorksheetSummary) => {
    if (editingId === summary.id) {
      return (
        <div key={summary.id} className={styles.wsEditRow}>
          <input
            className={styles.wsEditInput}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmRename();
              } else if (e.key === 'Escape') {
                setEditingId(null);
              }
            }}
            aria-label="Worksheet name"
          />
          <button
            type="button"
            className={styles.wsEditConfirm}
            aria-label="Save name"
            onClick={() => {
              void confirmRename();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.wsEditCancel}
            aria-label="Cancel rename"
            onClick={() => setEditingId(null)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      );
    }
    const isActive = summary.id === activeSavedWorksheet.id;
    return (
      <div
        key={summary.id}
        className={styles.wsRow}
        data-active={isActive || undefined}
      >
        <button
          type="button"
          className={styles.wsRowMain}
          onClick={() => {
            void selectSavedWorksheet(summary.id);
            setOpen(false);
          }}
        >
          <span className={styles.wsRowIcon} aria-hidden="true">
            {summary.isMain ? (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 21l-7-4.5L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
              </svg>
            )}
          </span>
          <span className={styles.wsRowInfo}>
            <span className={styles.wsRowName}>{summary.name}</span>
            <span className={styles.wsRowSubtitle}>
              {summary.isMain ? 'Main Worksheet' : 'Private Saved Worksheet'}
            </span>
          </span>
        </button>
        {!summary.isMain && (
          <>
            <button
              type="button"
              className={styles.wsIconButton}
              aria-label={`Rename ${summary.name}`}
              onClick={() => {
                setEditingId(summary.id);
                setEditingName(summary.name);
              }}
            >
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.wsIconButtonDanger}
              aria-label={`Delete ${summary.name}`}
              onClick={() => {
                void deleteSavedWorksheet(summary.id);
              }}
            >
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
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={clsx(
        styles.worksheetHeader,
        variant === 'navbar' && styles.worksheetHeaderNavbar,
      )}
      data-open={open || undefined}
    >
      <button
        type="button"
        className={styles.worksheetToggle}
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
      >
        {(variant === 'sidebar' || activeSavedWorksheet.isMain) && (
          <span className={styles.worksheetBookmark} aria-hidden="true">
            <svg
              width={variant === 'navbar' ? 13 : 15}
              height={variant === 'navbar' ? 13 : 15}
              viewBox="0 0 24 24"
              fill="#ef9f27"
              stroke="#ef9f27"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-4.5L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </span>
        )}
        <span className={styles.worksheetName}>
          {activeSavedWorksheet.name}
        </span>
        <svg
          width="9"
          height="5"
          viewBox="0 0 10 6"
          fill="none"
          className={styles.worksheetChevron}
          data-open={open || undefined}
          aria-hidden="true"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.worksheetMenu}>
          {termWorksheets.map(renderRow)}
          <div className={styles.wsDivider} />
          <button
            type="button"
            className={styles.wsNewButton}
            onClick={() => {
              void createBlankSavedWorksheetForTerm(viewedSeason);
              setOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Worksheet
          </button>
        </div>
      )}
    </div>
  );
}
