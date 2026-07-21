import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownButton,
  ListGroup,
  Modal,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from 'react-bootstrap';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { CiSettings } from 'react-icons/ci';
import { TbCalendarDown } from 'react-icons/tb';
import { useShallow } from 'zustand/react/shallow';

import ICSExportButton from './ICSExportButton';
import {
  getAnonymousWorksheetCourseCountsByTerm,
  useWorksheetSeasonCodes,
} from './SeasonDropdown';
import URLExportButton from './URLExportButton';
import WorksheetCalendarListContext from './WorksheetCalendarListContext';
import WorksheetCalendarListItem from './WorksheetCalendarListItem';
import { isWorksheetTerm } from '../../data/catalogSeasons';
import type { SavedWorksheetSummary } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import type { AnonymousWorksheetState } from '../../utilities/anonymousWorksheet';
import { toSeasonString } from '../../utilities/course';
import NoCourses from '../Search/NoCourses';
import { SurfaceComponent } from '../Typography';
import styles from './WorksheetCalendarList.module.css';

type AnonymousWorksheetTermChip = {
  term: Season;
  count: number;
  label: string;
};

export function getAnonymousWorksheetTermChips(
  anonymousWorksheet: AnonymousWorksheetState,
  seasonCodes: readonly Season[],
  viewedSeason: Season,
): AnonymousWorksheetTermChip[] {
  const counts = getAnonymousWorksheetCourseCountsByTerm(anonymousWorksheet);
  return seasonCodes.flatMap((term) => {
    const count = counts[term];
    if (!count || term === viewedSeason) return [];
    return [
      {
        term,
        count,
        label: `${toSeasonString(term)} (${count})`,
      },
    ];
  });
}

type SavedWorksheetTermChip = {
  term: Season;
  label: string;
};

export function getSavedWorksheetTermChips(
  allSummaries: SavedWorksheetSummary[],
  activeSavedWorksheetIdsByTerm: { [term: string]: number | undefined },
  viewedTerm: Season,
): SavedWorksheetTermChip[] {
  const summariesByTerm = new Map<string, SavedWorksheetSummary[]>();
  for (const s of allSummaries) {
    const list = summariesByTerm.get(s.term) ?? [];
    list.push(s);
    summariesByTerm.set(s.term, list);
  }

  const chips: SavedWorksheetTermChip[] = [];
  for (const [term, termSummaries] of summariesByTerm) {
    if (term === viewedTerm || !isWorksheetTerm(term as Season)) continue;
    const activeId = activeSavedWorksheetIdsByTerm[term];
    const resolved =
      (activeId ? termSummaries.find((s) => s.id === activeId) : undefined) ??
      termSummaries.find((s) => s.isMain);
    if (resolved && resolved.sectionCount > 0) {
      chips.push({
        term: term as Season,
        label: toSeasonString(term as Season),
      });
    }
  }
  return chips;
}

type WorksheetCalendarListProps = {
  readonly highlightBuilding: string | null;
  readonly showLocation: boolean;
  readonly showMissingLocationIcon: boolean;
  readonly controlsMode: 'full' | 'hide-only' | 'none' | 'map';
  readonly missingBuildingCodes: Set<string>;
  readonly hideTooltipContext: 'calendar' | 'map';
};

function WorksheetCalendarList({
  highlightBuilding,
  showLocation,
  showMissingLocationIcon,
  controlsMode,
  missingBuildingCodes,
  hideTooltipContext,
}: WorksheetCalendarListProps) {
  const {
    courses,
    viewedSeason,
    isReadonlyWorksheet,
    isExoticWorksheet,
    viewedPerson,
    user,
    isAnonymousWorksheet,
    anonymousWorksheet,
    changeViewedSeason,
    setAllAnonymousWorksheetHidden,
    setAllActiveSavedWorksheetHidden,
    clearAnonymousWorksheet,
    clearActiveSavedWorksheet,
    activeSavedWorksheet,
    activeSavedWorksheetIdsByTerm,
    allTermSavedWorksheetSummaries,
    ensureMainSavedWorksheetForTerm,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      isReadonlyWorksheet: state.worksheetMemo.getIsReadonlyWorksheet(state),
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      viewedPerson: state.viewedPerson,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      changeViewedSeason: state.changeViewedSeason,
      setAllAnonymousWorksheetHidden: state.setAllAnonymousWorksheetHidden,
      setAllActiveSavedWorksheetHidden: state.setAllActiveSavedWorksheetHidden,
      clearAnonymousWorksheet: state.clearAnonymousWorksheet,
      clearActiveSavedWorksheet: state.clearActiveSavedWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeSavedWorksheetIdsByTerm: state.activeSavedWorksheetIdsByTerm,
      allTermSavedWorksheetSummaries: state.allTermSavedWorksheetSummaries,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
    })),
  );

  const seasonCodes = useWorksheetSeasonCodes();
  const anonymousEmptyTermChips = useMemo(
    () =>
      isAnonymousWorksheet && courses.length === 0
        ? getAnonymousWorksheetTermChips(
            anonymousWorksheet,
            seasonCodes,
            viewedSeason,
          )
        : [],
    [
      anonymousWorksheet,
      courses.length,
      isAnonymousWorksheet,
      seasonCodes,
      viewedSeason,
    ],
  );

  const savedWorksheetEmptyTermChips = useMemo(
    () =>
      !isAnonymousWorksheet &&
      activeSavedWorksheet &&
      courses.length === 0 &&
      allTermSavedWorksheetSummaries.length > 0
        ? getSavedWorksheetTermChips(
            allTermSavedWorksheetSummaries,
            activeSavedWorksheetIdsByTerm,
            activeSavedWorksheet.term,
          )
        : [],
    [
      activeSavedWorksheet,
      activeSavedWorksheetIdsByTerm,
      allTermSavedWorksheetSummaries,
      courses.length,
      isAnonymousWorksheet,
    ],
  );

  const areHidden = useMemo(
    () => courses.length > 0 && courses.every((course) => course.hidden),
    [courses],
  );

  const HideShowIcon = areHidden ? BsEyeSlash : BsEye;
  const hasSavedWorksheetAccount = Boolean(user);
  const canMutateCurrentWorksheet =
    isAnonymousWorksheet || hasSavedWorksheetAccount;

  const showControls = controlsMode !== 'none';
  const showHideButton = controlsMode !== 'none' && canMutateCurrentWorksheet;
  const showSettings =
    (controlsMode === 'full' || controlsMode === 'map') &&
    canMutateCurrentWorksheet &&
    !isExoticWorksheet &&
    viewedPerson === 'me' &&
    (!isAnonymousWorksheet || courses.length > 0);
  const showExport = controlsMode === 'full';

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const contextValue = useMemo(
    () => ({
      showLocation,
      showMissingLocationIcon,
      highlightBuilding,
      missingBuildingCodes,
      hideTooltipContext,
    }),
    [
      showLocation,
      showMissingLocationIcon,
      highlightBuilding,
      missingBuildingCodes,
      hideTooltipContext,
    ],
  );

  const handleClearAll = async () => {
    if (courses.length === 0) return;

    if (isAnonymousWorksheet) {
      clearAnonymousWorksheet();
      setClearModalOpen(false);
      return;
    }

    if (hasSavedWorksheetAccount) {
      setClearing(true);
      try {
        const cleared = await clearActiveSavedWorksheet();
        if (cleared) setClearModalOpen(false);
      } finally {
        setClearing(false);
      }
    }
  };

  return (
    <div>
      {showControls && (
        <SurfaceComponent elevated className={styles.container}>
          <div className="shadow-sm p-2">
            <ButtonGroup className="w-100">
              {showHideButton && !isReadonlyWorksheet && (
                <OverlayTrigger
                  placement="top"
                  overlay={(props) => (
                    <Tooltip
                      id="worksheet-calendar-show-hide-tooltip"
                      {...props}
                    >
                      <span>{areHidden ? 'Show' : 'Hide'} all</span>
                    </Tooltip>
                  )}
                >
                  <Button
                    onClick={async () => {
                      if (isAnonymousWorksheet) {
                        setAllAnonymousWorksheetHidden(!areHidden);
                        return;
                      }
                      if (hasSavedWorksheetAccount)
                        await setAllActiveSavedWorksheetHidden(!areHidden);
                    }}
                    variant="none"
                    className={clsx(styles.button, 'px-3 w-100')}
                    aria-label={`${areHidden ? 'Show' : 'Hide'} all`}
                  >
                    <HideShowIcon
                      className={clsx(styles.icon, 'my-auto pe-2')}
                      size={32}
                    />
                  </Button>
                </OverlayTrigger>
              )}

              {showSettings && (
                <OverlayTrigger
                  placement="top"
                  overlay={(props) => (
                    <Tooltip
                      id="worksheet-calendar-settings-tooltip"
                      {...props}
                    >
                      <span>Worksheet Settings</span>
                    </Tooltip>
                  )}
                >
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSettingsModalOpen(true);
                    }}
                    variant="none"
                    className={clsx(styles.button, 'px-3 w-100')}
                    aria-label="Worksheet Settings"
                  >
                    <CiSettings className={clsx(styles.icon)} size={32} />
                  </Button>
                </OverlayTrigger>
              )}

              {showExport && (
                <OverlayTrigger
                  placement="top"
                  overlay={(props) => (
                    <Tooltip id="worksheet-calendar-export-tooltip" {...props}>
                      <span>Export worksheet calendar</span>
                    </Tooltip>
                  )}
                >
                  <DropdownButton
                    as="div"
                    drop="down"
                    align="end"
                    title={
                      <TbCalendarDown
                        className={clsx(styles.icon, styles.calendarIcon)}
                        size={22}
                      />
                    }
                    variant="none"
                    className={clsx(styles.button, 'w-100 btn')}
                  >
                    <Dropdown.Item eventKey="1" as="div">
                      <ICSExportButton />
                    </Dropdown.Item>
                    <Dropdown.Item eventKey="2" as="div">
                      <URLExportButton />
                    </Dropdown.Item>
                  </DropdownButton>
                </OverlayTrigger>
              )}
            </ButtonGroup>
          </div>
        </SurfaceComponent>
      )}

      <SurfaceComponent className={styles.courseList}>
        <WorksheetCalendarListContext.Provider value={contextValue}>
          {courses.length > 0 ? (
            <ListGroup variant="flush" className={styles.courseListGroup}>
              {courses.map((course) => (
                <WorksheetCalendarListItem
                  key={viewedSeason + course.crn}
                  listing={course.listing}
                  hidden={course.hidden ?? false}
                  color={course.color}
                />
              ))}
            </ListGroup>
          ) : (
            <NoCourses
              heading={
                anonymousEmptyTermChips.length > 0 ||
                savedWorksheetEmptyTermChips.length > 0
                  ? `${toSeasonString(viewedSeason)} worksheet is empty`
                  : undefined
              }
            >
              {anonymousEmptyTermChips.length > 0 ? (
                <div className={styles.emptyTermContent}>
                  <p className={styles.emptyTermText}>
                    This term&apos;s worksheet is empty. Your courses are in:
                  </p>
                  <div className={styles.emptyTermChips}>
                    {anonymousEmptyTermChips.map((chip) => (
                      <button
                        key={chip.term}
                        type="button"
                        className={styles.emptyTermChip}
                        onClick={() => changeViewedSeason(chip.term)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : savedWorksheetEmptyTermChips.length > 0 ? (
                <div className={styles.emptyTermContent}>
                  <p className={styles.emptyTermText}>
                    This term&apos;s worksheet is empty. Your courses are in:
                  </p>
                  <div className={styles.emptyTermChips}>
                    {savedWorksheetEmptyTermChips.map((chip) => (
                      <button
                        key={chip.term}
                        type="button"
                        className={styles.emptyTermChip}
                        onClick={() => {
                          void ensureMainSavedWorksheetForTerm(chip.term);
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : undefined}
            </NoCourses>
          )}
        </WorksheetCalendarListContext.Provider>
      </SurfaceComponent>

      <Modal
        show={settingsModalOpen}
        onHide={() => setSettingsModalOpen(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Worksheet Settings</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {courses.length > 0 && (
            <button
              type="button"
              onClick={() => setClearModalOpen(true)}
              disabled={clearing}
              className={styles.clearAllButton}
            >
              <strong>Clear All Classes</strong>
              <p className="text-muted small mb-0">
                {courses.length === 1
                  ? 'Remove this class from this worksheet'
                  : `Remove all ${courses.length} classes from this worksheet`}
              </p>
            </button>
          )}
        </Modal.Body>
      </Modal>

      <Modal
        show={clearModalOpen}
        onHide={() => !clearing && setClearModalOpen(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Clear All Classes</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            Are you sure you want to{' '}
            {courses.length === 1 ? (
              <>remove this class</>
            ) : (
              <>
                remove all <strong>{courses.length} classes</strong>
              </>
            )}{' '}
            from this worksheet?
          </p>
          <p className="text-muted small mb-0">This action cannot be undone.</p>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setClearModalOpen(false)}
            disabled={clearing}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleClearAll}
            disabled={clearing}
            style={{ minWidth: '4rem' }}
          >
            {clearing ? (
              <div className="ms-auto">
                <Spinner size="sm" />
              </div>
            ) : (
              'Clear All'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default WorksheetCalendarList;
