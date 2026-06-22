import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from 'react-bootstrap';
import { MdSave } from 'react-icons/md';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { isLegacyUserInfo } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import { getDefaultSavedWorksheetName } from '../../utilities/savedWorksheet';
import { Input } from '../Typography';
import styles from './LocalWorksheetImportPrompt.module.css';

export function LocalWorksheetImportPromptView({
  localSectionCount,
  defaultTerm,
  name,
  isSaving,
  savedWorksheetName,
  onNameChange,
  onSave,
}: {
  readonly localSectionCount: number;
  readonly defaultTerm: Season;
  readonly name: string;
  readonly isSaving: boolean;
  readonly savedWorksheetName: string | null;
  readonly onNameChange: (nextName: string) => void;
  readonly onSave: () => void;
}) {
  if (localSectionCount === 0) return null;

  const trimmedName = name.trim();
  const sectionLabel =
    localSectionCount === 1 ? '1 section' : `${localSectionCount} sections`;

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSave();
  };

  return (
    <section
      className={styles.prompt}
      aria-label="Local Worksheet account save prompt"
    >
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Local Worksheet</h2>
          <p className={styles.detail}>
            {sectionLabel} in this browser for {defaultTerm}.
          </p>
        </div>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <Input
          aria-label="Saved Worksheet name for Local Worksheet"
          className={styles.nameInput}
          value={name}
          maxLength={64}
          disabled={isSaving}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onNameChange(event.currentTarget.value)
          }
        />
        <Button
          type="submit"
          size="sm"
          className={styles.saveButton}
          disabled={isSaving || !trimmedName}
        >
          <MdSave aria-hidden="true" />
          <span>{isSaving ? 'Saving' : 'Save Local Worksheet'}</span>
        </Button>
      </form>
      {savedWorksheetName && (
        <div className={styles.status}>
          Saved &quot;{savedWorksheetName}&quot; and opened it.
        </div>
      )}
    </section>
  );
}

export default function LocalWorksheetImportPrompt() {
  const {
    activeSavedWorksheet,
    anonymousWorksheet,
    authStatus,
    isAnonymousWorksheet,
    isExoticWorksheet,
    savedWorksheetBootstrapStatus,
    saveAnonymousWorksheetToAccount,
    user,
  } = useStore(
    useShallow((state) => ({
      activeSavedWorksheet: state.activeSavedWorksheet,
      anonymousWorksheet: state.anonymousWorksheet,
      authStatus: state.authStatus,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      savedWorksheetBootstrapStatus: state.savedWorksheetBootstrapStatus,
      saveAnonymousWorksheetToAccount: state.saveAnonymousWorksheetToAccount,
      user: state.user,
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
  const [isSaving, setIsSaving] = useState(false);
  const [savedWorksheetName, setSavedWorksheetName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setName(defaultName);
    setSavedWorksheetName(null);
  }, [defaultName, worksheetKey]);

  const hasSavedWorksheetAccount =
    authStatus === 'authenticated' && user && !isLegacyUserInfo(user);
  const shouldShow =
    hasSavedWorksheetAccount &&
    savedWorksheetBootstrapStatus === 'ready' &&
    activeSavedWorksheet &&
    !isAnonymousWorksheet &&
    !isExoticWorksheet &&
    anonymousWorksheet.courses.length > 0;

  if (!shouldShow) return null;

  const saveLocalWorksheet = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const worksheet = await saveAnonymousWorksheetToAccount(name);
      if (worksheet) {
        setSavedWorksheetName(worksheet.name);
        toast.success('Local Worksheet saved to account');
      }
    } catch (error: unknown) {
      Sentry.captureException(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LocalWorksheetImportPromptView
      localSectionCount={anonymousWorksheet.courses.length}
      defaultTerm={anonymousWorksheet.term}
      name={name}
      isSaving={isSaving}
      savedWorksheetName={savedWorksheetName}
      onNameChange={setName}
      onSave={() => {
        void saveLocalWorksheet();
      }}
    />
  );
}
