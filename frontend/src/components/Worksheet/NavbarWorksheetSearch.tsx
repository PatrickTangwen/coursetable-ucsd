import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button, Dropdown } from 'react-bootstrap';
import { MdAdd, MdCheck, MdClose, MdDelete, MdEdit } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import SeasonDropdown, { useWorksheetSeasonCodes } from './SeasonDropdown';
import SegmentedControl from './SegmentedControl';
import WorksheetPicker from './WorksheetPicker';
import WorksheetStatusIcon from './WorksheetStatusIcon';

import type { SavedWorksheet, SavedWorksheetSummary } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import type { WorksheetView } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import { DropdownMenu } from '../Catalog/DropdownMenu';
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
  showWorksheetPicker,
  activeSavedWorksheet,
  savedWorksheetSummaries,
  selectSavedWorksheet,
  createBlankSavedWorksheetForTerm,
  renameSavedWorksheet,
  deleteSavedWorksheet,
  onSwitchTerm,
  seasonOptions,
  viewedSeason,
}: {
  readonly isMobile: boolean;
  readonly showWorksheetPicker: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetSummaries: SavedWorksheetSummary[];
  readonly selectSavedWorksheet: (id: number) => Promise<boolean>;
  readonly createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  readonly renameSavedWorksheet: (id: number, name: string) => Promise<boolean>;
  readonly deleteSavedWorksheet: (id: number) => Promise<boolean>;
  readonly onSwitchTerm: (term: Season) => void;
  readonly seasonOptions: { value: string; label: string }[];
  readonly viewedSeason: Season;
}) {
  return (
    <div
      className={clsx(
        styles.savedWorksheetControls,
        isMobile && styles.savedWorksheetControlsMobile,
      )}
      aria-label="Saved worksheet header"
    >
      <DropdownMenu
        label="Term"
        displayLabel={toSeasonString(viewedSeason)}
        options={seasonOptions}
        selectedValues={[viewedSeason]}
        onToggle={(season) => onSwitchTerm(season as Season)}
        closeOnToggle
        showCheckbox={false}
      />
      {showWorksheetPicker && (
        <WorksheetPicker
          variant="navbar"
          viewedSeason={viewedSeason}
          activeSavedWorksheet={activeSavedWorksheet}
          savedWorksheetSummaries={savedWorksheetSummaries}
          selectSavedWorksheet={selectSavedWorksheet}
          createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
          renameSavedWorksheet={renameSavedWorksheet}
          deleteSavedWorksheet={deleteSavedWorksheet}
        />
      )}
    </div>
  );
}

export function NavbarWorksheetSearchView({
  isMobile,
  worksheetView,
  changeWorksheetView,
  isExoticWorksheet,
  exitExoticWorksheet,
  hasSavedWorksheetAccount,
  activeSavedWorksheet,
  savedWorksheetSummaries,
  selectSavedWorksheet,
  createBlankSavedWorksheetForTerm,
  renameSavedWorksheet,
  deleteSavedWorksheet,
  onSwitchTerm,
  seasonOptions,
  viewedSeason,
  calendarMode,
  onChangeCalendarMode,
  finalsCount = 0,
}: {
  readonly isMobile: boolean;
  readonly worksheetView: WorksheetView;
  readonly changeWorksheetView: (view: VisibleWorksheetView) => void;
  readonly isExoticWorksheet: boolean;
  readonly exitExoticWorksheet: () => void;
  readonly hasSavedWorksheetAccount: boolean;
  readonly activeSavedWorksheet: SavedWorksheet | undefined;
  readonly savedWorksheetSummaries: SavedWorksheetSummary[];
  readonly selectSavedWorksheet: (id: number) => Promise<boolean>;
  readonly createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  readonly renameSavedWorksheet: (id: number, name: string) => Promise<boolean>;
  readonly deleteSavedWorksheet: (id: number) => Promise<boolean>;
  readonly onSwitchTerm: (term: Season) => void;
  readonly seasonOptions: { value: string; label: string }[];
  readonly viewedSeason: Season;
  readonly calendarMode?: 'week' | 'finals';
  readonly onChangeCalendarMode?: (mode: 'week' | 'finals') => void;
  readonly finalsCount?: number;
}) {
  const visibleWorksheetView =
    worksheetView === 'list' ? worksheetView : 'calendar';

  // Regular weeks vs finals week — only meaningful on the calendar view.
  const finalsToggle =
    onChangeCalendarMode && visibleWorksheetView === 'calendar' ? (
      <SegmentedControl
        wide
        value={calendarMode ?? 'week'}
        onChange={onChangeCalendarMode}
        options={[
          { value: 'week', label: 'Regular' },
          {
            value: 'finals',
            label: (
              <>
                Finals
                {calendarMode === 'finals' && finalsCount > 0 && (
                  <span className={styles.finalsBadge}>{finalsCount}</span>
                )}
              </>
            ),
          },
        ]}
      />
    ) : null;

  // Mobile: dropdown styled like toggle, flush right next to hamburger
  if (isMobile) {
    return (
      <div className={styles.containerMobile}>
        {finalsToggle}
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
            showWorksheetPicker
            activeSavedWorksheet={activeSavedWorksheet}
            savedWorksheetSummaries={savedWorksheetSummaries}
            selectSavedWorksheet={selectSavedWorksheet}
            createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
            renameSavedWorksheet={renameSavedWorksheet}
            deleteSavedWorksheet={deleteSavedWorksheet}
            onSwitchTerm={onSwitchTerm}
            seasonOptions={seasonOptions}
            viewedSeason={viewedSeason}
          />
        )}
      </div>
    );
  }

  // Desktop: term/worksheet controls on the left, Regular/Finals next to
  // them, view toggle pushed right (finalized SunGrid calendar navbar order).
  return (
    <div className={styles.container}>
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
      ) : hasSavedWorksheetAccount ? (
        // On the calendar view the sidebar owns the worksheet picker, so the
        // navbar only shows the term selector; the list view has no other
        // switcher, so the picker stays in the navbar there.
        <SavedWorksheetHeaderControlsView
          isMobile={isMobile}
          showWorksheetPicker={visibleWorksheetView === 'list'}
          activeSavedWorksheet={activeSavedWorksheet}
          savedWorksheetSummaries={savedWorksheetSummaries}
          selectSavedWorksheet={selectSavedWorksheet}
          createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
          renameSavedWorksheet={renameSavedWorksheet}
          deleteSavedWorksheet={deleteSavedWorksheet}
          onSwitchTerm={onSwitchTerm}
          seasonOptions={seasonOptions}
          viewedSeason={viewedSeason}
        />
      ) : (
        <SeasonDropdown mobile={false} />
      )}
      {finalsToggle}
      <div className={styles.spacer} />
      <SegmentedControl
        value={visibleWorksheetView}
        onChange={changeWorksheetView}
        dataTutorial="worksheet-2"
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'list', label: 'List' },
        ]}
      />
    </div>
  );
}

export function countCoursesWithFinals(
  courses: readonly { listing: { course: { course_meetings: unknown[] } } }[],
) {
  return courses.filter((course) =>
    course.listing.course.course_meetings.some((meeting) => {
      const extended = meeting as {
        date?: string | null;
        meeting_type?: string | null;
      };
      return Boolean(extended.date) && extended.meeting_type === 'Final';
    }),
  ).length;
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
    selectSavedWorksheet,
    createBlankSavedWorksheetForTerm,
    renameSavedWorksheet,
    deleteSavedWorksheet,
    ensureMainSavedWorksheetForTerm,
    viewedSeason,
  } = useStore(
    useShallow((state) => ({
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exitExoticWorksheet: state.exitExoticWorksheet,
      user: state.user,
      activeSavedWorksheet: state.activeSavedWorksheet,
      savedWorksheetSummaries: state.savedWorksheetSummaries,
      selectSavedWorksheet: state.selectSavedWorksheet,
      createBlankSavedWorksheetForTerm: state.createBlankSavedWorksheetForTerm,
      renameSavedWorksheet: state.renameSavedWorksheet,
      deleteSavedWorksheet: state.deleteSavedWorksheet,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      viewedSeason: state.viewedSeason,
    })),
  );
  const { calendarMode, setCalendarMode, courses } = useStore(
    useShallow((state) => ({
      calendarMode: state.calendarMode,
      setCalendarMode: state.setCalendarMode,
      courses: state.courses,
    })),
  );

  const finalsCount = useMemo(() => countCoursesWithFinals(courses), [courses]);

  const seasonCodes = useWorksheetSeasonCodes();
  const seasonOptions = useMemo(
    () =>
      seasonCodes.map((seasonCode) => ({
        value: seasonCode,
        label: toSeasonString(seasonCode),
      })),
    [seasonCodes],
  );

  const hasSavedWorksheetAccount = Boolean(user);

  return (
    <NavbarWorksheetSearchView
      isMobile={isMobile}
      worksheetView={worksheetView}
      changeWorksheetView={changeWorksheetView}
      isExoticWorksheet={isExoticWorksheet}
      exitExoticWorksheet={exitExoticWorksheet}
      hasSavedWorksheetAccount={hasSavedWorksheetAccount}
      activeSavedWorksheet={activeSavedWorksheet}
      savedWorksheetSummaries={savedWorksheetSummaries}
      selectSavedWorksheet={selectSavedWorksheet}
      createBlankSavedWorksheetForTerm={createBlankSavedWorksheetForTerm}
      renameSavedWorksheet={renameSavedWorksheet}
      deleteSavedWorksheet={deleteSavedWorksheet}
      onSwitchTerm={(term) => {
        void ensureMainSavedWorksheetForTerm(term);
      }}
      seasonOptions={seasonOptions}
      viewedSeason={viewedSeason}
      calendarMode={calendarMode}
      onChangeCalendarMode={setCalendarMode}
      finalsCount={finalsCount}
    />
  );
}
