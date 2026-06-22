import clsx from 'clsx';
import {
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dropdown,
} from 'react-bootstrap';
import { useShallow } from 'zustand/react/shallow';
import SeasonDropdown from './SeasonDropdown';
import WorksheetNumDropdown from './WorksheetNumberDropdown';
import WorksheetStatusIcon from './WorksheetStatusIcon';

import { CUR_SEASON } from '../../config';
import { isLegacyUserInfo, type SavedWorksheet } from '../../queries/api';
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

function SavedWorksheetHeaderControlsView({
  isMobile,
  activeSavedWorksheet,
  savedWorksheetBootstrapStatus,
}: {
  readonly isMobile: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetBootstrapStatus:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
}) {
  const term = activeSavedWorksheet?.term ?? CUR_SEASON;
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
      <span className={styles.termBadge} aria-label={`Active term ${term}`}>
        {term}
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
        <div className={styles.savedWorksheetMenu}>
          <div className={styles.savedWorksheetOption}>
            {WorksheetStatusIcon(
              activeSavedWorksheet?.isMain === false ? 1 : 0,
              activeSavedWorksheet?.private,
            )}
            <span>{worksheetName}</span>
          </div>
          <div className={styles.savedWorksheetStatusText}>
            {activeSavedWorksheet?.isMain === false
              ? 'Saved Worksheet'
              : 'Main Worksheet'}
          </div>
        </div>
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
  savedWorksheetBootstrapStatus,
}: {
  readonly isMobile: boolean;
  readonly worksheetView: WorksheetView;
  readonly changeWorksheetView: (view: VisibleWorksheetView) => void;
  readonly isExoticWorksheet: boolean;
  readonly exitExoticWorksheet: () => void;
  readonly hasLegacyWorksheetAccount: boolean;
  readonly hasSavedWorksheetAccount: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetBootstrapStatus:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
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
            savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
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
          savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
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
    savedWorksheetBootstrapStatus,
  } = useStore(
    useShallow((state) => ({
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exitExoticWorksheet: state.exitExoticWorksheet,
      user: state.user,
      activeSavedWorksheet: state.activeSavedWorksheet,
      savedWorksheetBootstrapStatus: state.savedWorksheetBootstrapStatus,
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
      savedWorksheetBootstrapStatus={savedWorksheetBootstrapStatus}
    />
  );
}
