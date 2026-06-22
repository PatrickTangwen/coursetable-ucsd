import clsx from 'clsx';
import {
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dropdown,
} from 'react-bootstrap';
import { MdAdd } from 'react-icons/md';
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
  isCreating,
}: {
  readonly term: Season;
  readonly activeWorksheetId: number | undefined;
  readonly savedWorksheetSummaries: readonly SavedWorksheetSummary[];
  readonly onSelectSavedWorksheet: (id: number) => Promise<unknown>;
  readonly onCreateBlankSavedWorksheet: () => Promise<unknown>;
  readonly isCreating: boolean;
}) {
  const termWorksheets = getTermSavedWorksheets(term, savedWorksheetSummaries);

  return (
    <div className={styles.savedWorksheetMenu}>
      {termWorksheets.map((worksheet) => (
        <button
          key={worksheet.id}
          type="button"
          className={clsx(
            styles.savedWorksheetOption,
            activeWorksheetId === worksheet.id &&
              styles.savedWorksheetOptionActive,
          )}
          aria-current={activeWorksheetId === worksheet.id ? 'true' : undefined}
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
              {worksheet.isMain ? 'Main Worksheet' : 'Saved Worksheet'}
            </span>
          </span>
        </button>
      ))}
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
          />
        )}
      </div>
    );
  }

  // Desktop: show full toggle with controls
  return (
    <div className={clsx(styles.container, 'd-flex align-items-center')}>
      <ToggleButtonGroup
        name="worksheet-view-toggle"
        type="radio"
        value={visibleWorksheetView}
        onChange={(val: VisibleWorksheetView) => changeWorksheetView(val)}
        className={clsx(styles.toggleButtonGroup, 'ms-2 me-3')}
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
        />
      ) : null}
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
    />
  );
}
