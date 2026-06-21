import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { Button } from 'react-bootstrap';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import {
  createSavedWorksheetFromAnonymous,
  type SavedWorksheet,
} from '../../queries/api';
import { useStore } from '../../store';
import {
  buildSaveAnonymousWorksheetPayload,
  canSaveAnonymousWorksheet,
  getDefaultSavedWorksheetName,
} from '../../utilities/savedWorksheet';
import { Input } from '../Typography';
import styles from './SavedWorksheetSavePanel.module.css';

export default function SavedWorksheetSavePanel({
  onSaved,
}: {
  readonly onSaved?: () => void;
}) {
  const { authStatus, anonymousWorksheet } = useStore(
    useShallow((state) => ({
      authStatus: state.authStatus,
      anonymousWorksheet: state.anonymousWorksheet,
    })),
  );
  const defaultName = useMemo(
    () => getDefaultSavedWorksheetName(anonymousWorksheet.term),
    [anonymousWorksheet.term],
  );
  const worksheetKey = useMemo(
    () =>
      JSON.stringify({
        term: anonymousWorksheet.term,
        courses: anonymousWorksheet.courses,
      }),
    [anonymousWorksheet],
  );
  const [name, setName] = useState(defaultName);
  const [savedWorksheet, setSavedWorksheet] = useState<SavedWorksheet | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const canSave = canSaveAnonymousWorksheet(authStatus);
  const trimmedName = name.trim();

  useEffect(() => {
    setName(defaultName);
    setSavedWorksheet(null);
  }, [defaultName, worksheetKey]);

  const saveWorksheet = async () => {
    if (!canSave || !trimmedName || isSaving) return;

    setIsSaving(true);
    try {
      const result = await createSavedWorksheetFromAnonymous(
        buildSaveAnonymousWorksheetPayload(trimmedName, anonymousWorksheet),
      );
      if (result) {
        setSavedWorksheet(result);
        onSaved?.();
        toast.success('Worksheet saved');
      }
    } catch (err: unknown) {
      Sentry.captureException(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (authStatus === 'loading' || authStatus === 'initializing')
    return <div className={styles.status}>Checking sign-in...</div>;

  if (!canSave) {
    return (
      <div className={styles.signInRequired}>
        <span>Sign in required.</span>
        <a href="/login">Sign in to save or restore worksheets</a>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.inputRow}>
        <Input
          aria-label="Saved worksheet name"
          className={styles.nameInput}
          value={name}
          maxLength={64}
          disabled={isSaving}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setName(event.target.value)
          }
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void saveWorksheet();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={isSaving || !trimmedName}
          onClick={() => {
            void saveWorksheet();
          }}
        >
          {isSaving ? 'Saving' : 'Save'}
        </Button>
      </div>
      {savedWorksheet && (
        <div className={styles.status}>
          Saved &quot;{savedWorksheet.name}&quot; as worksheet #
          {savedWorksheet.id}.
        </div>
      )}
    </div>
  );
}
