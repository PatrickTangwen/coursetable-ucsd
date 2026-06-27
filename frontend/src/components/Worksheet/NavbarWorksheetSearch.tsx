import { useState } from 'react';
import clsx from 'clsx';
import {
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dropdown,
} from 'react-bootstrap';
import { MdAdd, MdCheck, MdClose, MdDelete, MdEdit } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import SeasonDropdown from './SeasonDropdown';
import WorksheetNumDropdown from './WorksheetNumberDropdown';
import WorksheetStatusIcon from './WorksheetStatusIcon';

import { CUR_SEASON } from '../../config';
import {
  isLegacyUserInfo,
  type SavedWorksheet,
  type SavedWorksheetSummary,
} from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import type { WorksheetView } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { Popout } from '../Search/Popout';
import styles from './NavbarWorksheetSearch.module.css';

type VisibleWorksheetView = Exclude<WorksheetView, 'map'>;

const visibleWorksheetViews: VisibleWorksheetView[] = ['calendar', 'list'];

const viewLabels: { [key in VisibleWorksheetView]: string } = {
  calendar: 'Calendar',
  list: 'List',
};

function getTermSavedWorksheets(
  term: Season,
  worksheets: readonly SavedWorksheetSummary[],
) {
  return worksheets
    .filter((worksheet) => worksheet.term === term)
    .sort((a, b) => {
      if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
}

export function SavedWorksheetMenuView({
  term,
  activeWorksheetId,
  savedWorksheetSummaries,
  onSelectSavedWorksheet,
  onCreateBlankSavedWorksheet,
  onRenameSavedWorksheet,
  onDeleteSavedWorksheet,
  isCreating,
}: {
  readonly term: Season;
  readonly activeWorksheetId: number | undefined;
  readonly savedWorksheetSummaries: readonly SavedWorksheetSummary[];
  readonly onSelectSavedWorksheet: (id: number) => Promise<unknown>;
  readonly onCreateBlankSavedWorksheet: () => Promise<unknown>;
  readonly onRenameSavedWorksheet: (
    id: number,
    name: string,
  ) => Promise<unknown>;
  readonly onDeleteSavedWorksheet: (id: number) => Promise<unknown>;
  readonly isCreating: boolean;
}) {
  const termWorksheets = getTermSavedWorksheets(term, savedWorksheetSummaries);
  const [renamingWorksheetId, setRenamingWorksheetId] = useState<number | null>(
    null,
  );
  const [renamingWorksheetName, setRenamingWorksheetName] = useState('');
  const [confirmingDeleteWorksheetId, setConfirmingDeleteWorksheetId] =
    useState<number | null>(null);

  return (
    <div className={styles.savedWorksheetMenu}>
      {termWorksheets.map((worksheet) => {
        const isActive = activeWorksheetId === worksheet.id;
        const canManage = !worksheet.isMain;
        const isRenaming = renamingWorksheetId === worksheet.id;
        const isConfirmingDelete = confirmingDeleteWorksheetId === worksheet.id;

        if (isRenaming) {
          return (
            <form
              key={worksheet.id}
              className={styles.savedWorksheetEditRow}
              onSubmit={(event) => {
                event.preventDefault();
                const name = renamingWorksheetName.trim() || 'New Worksheet';
                onRenameSavedWorksheet(worksheet.id, name)
                  .then(() => {
                    setRenamingWorksheetId(null);
                    setRenamingWorksheetName('');
                  })
                  .catch(() => {});
              }}
            >
              <input
                className={styles.savedWorksheetNameInput}
                value={renamingWorksheetName}
                onChange={(event) =>
                  setRenamingWorksheetName(event.currentTarget.value)
                }
                maxLength={64}
                aria-label={`Rename ${worksheet.name}`}
              />
              <button
                type="submit"
                className={styles.savedWorksheetIconButton}
                aria-label={`Save ${worksheet.name}`}
                title="Save worksheet name"
              >
                <MdCheck aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.savedWorksheetIconButton}
                aria-label={`Cancel renaming ${worksheet.name}`}
                title="Cancel"
                onClick={() => {
                  setRenamingWorksheetId(null);
                  setRenamingWorksheetName('');
                }}
              >
                <MdClose aria-hidden="true" />
              </button>
            </form>
          );
        }

        if (isConfirmingDelete) {
          return (
            <div key={worksheet.id} className={styles.savedWorksheetDeleteRow}>
              <button
                type="button"
                className={styles.keepSavedWorksheetButton}
                onClick={() => setConfirmingDeleteWorksheetId(null)}
              >
                Keep
              </button>
              <button
                type="button"
                className={styles.confirmDeleteSavedWorksheetButton}
                onClick={() => {
                  onDeleteSavedWorksheet(worksheet.id)
                    .then(() => setConfirmingDeleteWorksheetId(null))
                    .catch(() => {});
                }}
              >
                Delete
              </button>
            </div>
          );
        }

        return (
          <div
            key={worksheet.id}
            className={clsx(
              styles.savedWorksheetOptionRow,
              isActive && styles.savedWorksheetOptionActive,
            )}
            aria-current={isActive ? 'true' : undefined}
          >
            <button
              type="button"
              className={styles.savedWorksheetOption}
              onClick={() => {
                onSelectSavedWorksheet(worksheet.id).catch(() => {});
              }}
            >
              {WorksheetStatusIcon(worksheet.isMain ? 0 : 1, worksheet.private)}
              <span className={styles.savedWorksheetOptionText}>
                <span className={styles.savedWorksheetOptionName}>
                  {worksheet.name}
                </span>
                <span className={styles.savedWorksheetStatusText}>
                  {worksheet.isMain
                    ? 'Main Worksheet'
                    : 'Private Saved Worksheet'}
                </span>
              </span>
            </button>
            {canManage ? (
              <span className={styles.savedWorksheetActions}>
                <button
                  type="button"
                  className={styles.savedWorksheetIconButton}
                  aria-label={`Rename ${worksheet.name}`}
                  title="Rename worksheet"
                  onClick={() => {
                    setConfirmingDeleteWorksheetId(null);
                    setRenamingWorksheetId(worksheet.id);
                    setRenamingWorksheetName(worksheet.name);
                  }}
                >
                  <MdEdit aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.savedWorksheetIconButton}
                  aria-label={`Delete ${worksheet.name}`}
                  title="Delete worksheet"
                  onClick={() => {
                    setRenamingWorksheetId(null);
                    setRenamingWorksheetName('');
                    setConfirmingDeleteWorksheetId(worksheet.id);
                  }}
                >
                  <MdDelete aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className={styles.createSavedWorksheetButton}
        disabled={isCreating}
        onClick={() => {
          onCreateBlankSavedWorksheet().catch(() => {});
        }}
        aria-label="Create blank saved worksheet"
      >
        <MdAdd aria-hidden="true" />
        <span>{isCreating ? 'Creating' : 'New Worksheet'}</span>
      </button>
    </div>
  );
}

function SavedWorksheetHeaderControlsView({
  isMobile,
  activeSavedWorksheet,
  savedWorksheetSummaries,
  savedWorksheetListStatus,
  savedWorksheetBootstrapStatus,
  selectSavedWorksheet,
  createBlankSavedWorksheetForTerm,
  renameSavedWorksheet,
  deleteSavedWorksheet,
}: {
  readonly isMobile: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetSummaries: SavedWorksheetSummary[];
  readonly savedWorksheetListStatus: 'idle' | 'loading' | 'ready' | 'error';
  readonly savedWorksheetBootstrapStatus:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
  readonly selectSavedWorksheet: (id: number) => Promise<boolean>;
  readonly createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  readonly renameSavedWorksheet: (id: number, name: string) => Promise<boolean>;
  readonly deleteSavedWorksheet: (id: number) => Promise<boolean>;
}) {
  const activeTerm = activeSavedWorksheet?.term ?? CUR_SEASON;
  const worksheetName =
    savedWorksheetBootstrapStatus === 'loading'
      ? 'Loading worksheet'
      : (activeSavedWorksheet?.name ?? 'Main Worksheet');
  const selectedWorksheet = {
    value: activeSavedWorksheet?.id ?? 'main',
    label: worksheetName,
  };
  const worksheetIcon = WorksheetStatusIcon(
    activeSavedWorksheet?.isMain === false ? 1 : 0,
    activeSavedWorksheet?.private,
  );

  return (
    <div
      className={clsx(
        styles.savedWorksheetControls,
        isMobile && styles.savedWorksheetControlsMobile,
      )}
      aria-label="Saved worksheet header"
    >
      <span
        className={styles.termBadge}
        aria-label={`Active term ${activeTerm}`}
      >
        {activeTerm}
      </span>
      <Popout
        buttonText="Worksheet"
        ariaLabel={`Active saved worksheet: ${worksheetName}`}
        displayOptionLabel
        selectedOptions={selectedWorksheet}
        clearIcon={false}
        Icon={worksheetIcon}
        className={styles.savedWorksheetButton}
        dropdownClassName={styles.savedWorksheetDropdown}
      >
        <SavedWorksheetMenuView
          term={activeTerm}
          activeWorksheetId={activeSavedWorksheet?.id}
          savedWorksheetSummaries={savedWorksheetSummaries}
          onSelectSavedWorksheet={selectSavedWorksheet}
          onCreateBlankSavedWorksheet={() =>
            createBlankSavedWorksheetForTerm(activeTerm)
          }
          onRenameSavedWorksheet={renameSavedWorksheet}
          onDeleteSavedWorksheet={deleteSavedWorksheet}
          isCreating={savedWorksheetListStatus === 'loading'}
        />
      </Popout>
    </div>
  );
}

export function NavbarWorksheetSearchView({
  isMobile,
  worksheetView,
  changeWorksheetView,
  isExoticWorksheet,
  exitExoticWorksheet,
  hasLegacyWorksheetAccount,
  hasSavedWorksheetAccount,
  activeSavedWorksheet,
  savedWorksheetSummaries,
  savedWorksheetListStatus,
  savedWorksheetBootstrapStatus,
  selectSavedWorksheet,
  createBlankSavedWorksheetForTerm,
  renameSavedWorksheet,
  deleteSavedWorksheet,
}: {
  readonly isMobile: boolean;
  readonly worksheetView: WorksheetView;
  readonly changeWorksheetView: (view: VisibleWorksheetView) => void;
  readonly isExoticWorksheet: boolean;
  readonly exitExoticWorksheet: () => void;
  readonly hasLegacyWorksheetAccount: boolean;
  readonly hasSavedWorksheetAccount: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetSummaries: SavedWorksheetSummary[];
  readonly savedWorksheetListStatus: 'idle' | 'loading' | 'ready' | 'error';
  readonly savedWorksheetBootstrapStatus:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
  readonly selectSavedWorksheet: (id: number) => Promise<boolean>;
  readonly createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  readonly renameSavedWorksheet: (id: number, name: string) => Promise<boolean>;
  readonly deleteSavedWorksheet: (id: number) => Promise<boolean>;
}) {
  const visibleWorksheetView =
    worksheetView === 'list' ? worksheetView : 'calendar';

  // Mobile: dropdown styled like toggle, flush right next to hamburger
  if (isMobile) {
    return (
      <div className={styles.containerMobile}>
        <Dropdown align="end">
          <Dropdown.Toggle className={styles.viewDropdownToggle}>
            <span className={styles.toggleButtonContent}>
              <span>{viewLabels[visibleWorksheetView]}</span>
            </span>
          </Dropdown.Toggle>
          <Dropdown.Menu className={styles.viewDropdownMenu}>
            {visibleWorksheetViews.map((view) => (
              <Dropdown.Item
                key={view}
                className={clsx(
                  styles.viewDropdownItem,
                  visibleWorksheetView === view &&
                    styles.viewDropdownItemActive,
                )}
                onClick={() => changeWorksheetView(view)}
              >
                <span className={styles.toggleButtonContent}>
                  <span>{viewLabels[view]}</span>
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        {hasSavedWorksheetAccount && (
          <SavedWorksheetHeaderControlsView
            isMobile={isMobile}
            activeSavedWorksheet={activeSavedWorksheet}
            savedWorksheetSummaries={savedWorksheetSummaries}
            savedWorksheetListStatus={savedWorksheetListStatus}
            savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
            selectSavedWorksheet={selectSavedWorksheet}
            createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
            renameSavedWorksheet={renameSavedWorksheet}
            deleteSavedWorksheet={deleteSavedWorksheet}
          />
        )}
      </div>
    );
  }

  // Desktop: show full toggle with controls
  return (
    <div className={styles.container}>
      <ToggleButtonGroup
        name="worksheet-view-toggle"
        type="radio"
        value={visibleWorksheetView}
        onChange={(val: VisibleWorksheetView) => changeWorksheetView(val)}
        className={styles.toggleButtonGroup}
        data-tutorial="worksheet-2"
      >
        <ToggleButton
          id="view-toggle-calendar"
          className={styles.toggleButton}
          value="calendar"
        >
          Calendar
        </ToggleButton>
        <ToggleButton
          id="view-toggle-list"
          className={styles.toggleButton}
          value="list"
        >
          List
        </ToggleButton>
      </ToggleButtonGroup>
      {isExoticWorksheet ? (
        <div className={styles.exoticWorksheetContainer}>
          <span className={styles.exoticWorksheetText}>
            Viewing exported worksheet
          </span>
          <Button
            variant="primary"
            className={styles.exoticExitButton}
            onClick={exitExoticWorksheet}
          >
            Exit
          </Button>
        </div>
      ) : hasLegacyWorksheetAccount ? (
        <>
          <SeasonDropdown mobile={false} />
          <WorksheetNumDropdown mobile={false} />
        </>
      ) : hasSavedWorksheetAccount ? (
        <SavedWorksheetHeaderControlsView
          isMobile={isMobile}
          activeSavedWorksheet={activeSavedWorksheet}
          savedWorksheetSummaries={savedWorksheetSummaries}
          savedWorksheetListStatus={savedWorksheetListStatus}
          savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
          selectSavedWorksheet={selectSavedWorksheet}
          createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
          renameSavedWorksheet={renameSavedWorksheet}
          deleteSavedWorksheet={deleteSavedWorksheet}
        />
      ) : (
        <SeasonDropdown mobile={false} />
      )}
    </div>
  );
}

export function NavbarWorksheetSearch({
  isMobile,
}: {
  readonly isMobile: boolean;
}) {
  const {
    worksheetView,
    changeWorksheetView,
    isExoticWorksheet,
    exitExoticWorksheet,
    user,
    activeSavedWorksheet,
    savedWorksheetSummaries,
    savedWorksheetListStatus,
    savedWorksheetBootstrapStatus,
    selectSavedWorksheet,
    createBlankSavedWorksheetForTerm,
    renameSavedWorksheet,
    deleteSavedWorksheet,
  } = useStore(
    useShallow((state) => ({
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exitExoticWorksheet: state.exitExoticWorksheet,
      user: state.user,
      activeSavedWorksheet: state.activeSavedWorksheet,
      savedWorksheetSummaries: state.savedWorksheetSummaries,
      savedWorksheetListStatus: state.savedWorksheetListStatus,
      savedWorksheetBootstrapStatus: state.savedWorksheetBootstrapStatus,
      selectSavedWorksheet: state.selectSavedWorksheet,
      createBlankSavedWorksheetForTerm: state.createBlankSavedWorksheetForTerm,
      renameSavedWorksheet: state.renameSavedWorksheet,
      deleteSavedWorksheet: state.deleteSavedWorksheet,
    })),
  );

  const hasLegacyWorksheetAccount = isLegacyUserInfo(user);
  const hasSavedWorksheetAccount = Boolean(user && !hasLegacyWorksheetAccount);

  return (
    <NavbarWorksheetSearchView
      isMobile={isMobile}
      worksheetView={worksheetView}
      changeWorksheetView={changeWorksheetView}
      isExoticWorksheet={isExoticWorksheet}
      exitExoticWorksheet={exitExoticWorksheet}
      hasLegacyWorksheetAccount={hasLegacyWorksheetAccount}
      hasSavedWorksheetAccount={hasSavedWorksheetAccount}
      activeSavedWorksheet={activeSavedWorksheet}
      savedWorksheetSummaries={savedWorksheetSummaries}
      savedWorksheetListStatus={savedWorksheetListStatus}
      savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
      selectSavedWorksheet={selectSavedWorksheet}
      createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
      renameSavedWorksheet={renameSavedWorksheet}
      deleteSavedWorksheet={deleteSavedWorksheet}
    />
  );
}
