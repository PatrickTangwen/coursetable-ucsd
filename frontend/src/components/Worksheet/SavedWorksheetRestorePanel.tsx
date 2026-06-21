import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { Button } from 'react-bootstrap';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import {
  fetchSavedWorksheet,
  fetchSavedWorksheets,
  type SavedWorksheetSummary,
} from '../../queries/api';
import { useStore } from '../../store';
import { canRestoreSavedWorksheet } from '../../utilities/savedWorksheet';
import styles from './SavedWorksheetRestorePanel.module.css';

function describeWorksheet(summary: SavedWorksheetSummary) {
  const sectionLabel = summary.sectionCount === 1 ? 'section' : 'sections';
  return `${summary.sectionCount} ${sectionLabel}`;
}

export default function SavedWorksheetRestorePanel({
  refreshKey,
}: {
  readonly refreshKey: number;
}) {
  const { authStatus, restoreSavedWorksheet } = useStore(
    useShallow((state) => ({
      authStatus: state.authStatus,
      restoreSavedWorksheet: state.restoreSavedWorksheet,
    })),
  );
  const [worksheets, setWorksheets] = useState<SavedWorksheetSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastRestoredName, setLastRestoredName] = useState('');
  const canRestore = canRestoreSavedWorksheet(authStatus);

  const loadWorksheets = useCallback(async () => {
    if (!canRestore) {
      setWorksheets([]);
      setSelectedId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchSavedWorksheets();
      const nextWorksheets = result?.data ?? [];
      setWorksheets(nextWorksheets);
      setSelectedId((currentId) =>
        currentId &&
        nextWorksheets.some((worksheet) => worksheet.id === currentId)
          ? currentId
          : (nextWorksheets[0]?.id ?? null),
      );
    } catch (err: unknown) {
      Sentry.captureException(err);
      setWorksheets([]);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  }, [canRestore]);

  useEffect(() => {
    void loadWorksheets();
  }, [loadWorksheets, refreshKey]);

  const selectedWorksheet = useMemo(
    () => worksheets.find((worksheet) => worksheet.id === selectedId) ?? null,
    [worksheets, selectedId],
  );

  const restoreWorksheet = async () => {
    if (!canRestore || !selectedWorksheet || isRestoring) return;

    setIsRestoring(true);
    try {
      const worksheet = await fetchSavedWorksheet(selectedWorksheet.id);
      if (!worksheet) return;
      restoreSavedWorksheet(worksheet);
      setLastRestoredName(worksheet.name);
      toast.success(`Restored ${worksheet.name}`);
    } catch (err: unknown) {
      Sentry.captureException(err);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!canRestore) return null;

  if (isLoading)
    return <div className={styles.status}>Loading saved worksheets...</div>;

  if (worksheets.length === 0) {
    return (
      <div className={styles.status}>
        No saved worksheets yet. Save this worksheet first.
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.inputRow}>
        <select
          aria-label="Saved worksheet to restore"
          className={styles.select}
          value={selectedId ?? ''}
          disabled={isRestoring}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setSelectedId(Number(event.target.value))
          }
        >
          {worksheets.map((worksheet) => (
            <option key={worksheet.id} value={worksheet.id}>
              {worksheet.name} ({describeWorksheet(worksheet)})
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={isRestoring || !selectedWorksheet}
          onClick={() => {
            void restoreWorksheet();
          }}
        >
          {isRestoring ? 'Restoring' : 'Restore'}
        </Button>
      </div>
      {selectedWorksheet && (
        <div className={styles.status}>
          Selected worksheet #{selectedWorksheet.id}, owned by this account.
        </div>
      )}
      {lastRestoredName && (
        <div className={styles.status}>
          Restored &quot;{lastRestoredName}&quot; into this worksheet.
        </div>
      )}
    </div>
  );
}
