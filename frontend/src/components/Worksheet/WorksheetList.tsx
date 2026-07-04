import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  DropdownButton,
  Form,
  Modal,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from 'react-bootstrap';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { FiDownload, FiLink, FiSettings } from 'react-icons/fi';
import { TbCalendarUp } from 'react-icons/tb';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useICSExport } from './ICSExportButton';
import { useWorksheetSeasonCodes } from './SeasonDropdown';
import { useWorksheetURLExport } from './URLExportButton';
import {
  buildCourseImports,
  getAnonymousWorksheetTermChips,
  getSavedWorksheetTermChips,
} from './WorksheetCalendarList';
import WorksheetListItem from './WorksheetListItem';
import WorksheetStatusIcon from './WorksheetStatusIcon';
import {
  isLegacyUserInfo,
  setCourseHidden,
  updateWorksheetCourses,
  updateWorksheetMetadata,
} from '../../queries/api';
import type { Crn } from '../../queries/graphql-types';
import { useWorksheetNumberOptions } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import {
  getWorksheetCourseStats,
  toSeasonString,
} from '../../utilities/course';
import {
  getScheduleConflicts,
  groupConflictsByCrn,
  summarizeConflictPairs,
} from '../../utilities/scheduleConflicts';
import NoCourses from '../Search/NoCourses';
import styles from './WorksheetList.module.css';

function ExpandAllIcon({ allExpanded }: { readonly allExpanded: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {allExpanded ? (
        <>
          <polyline points="7 9 12 4 17 9" />
          <polyline points="7 15 12 20 17 15" />
        </>
      ) : (
        <>
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </>
      )}
    </svg>
  );
}

function WorksheetExportMenu({ onClose }: { readonly onClose: () => void }) {
  const ics = useICSExport();
  const exportURL = useWorksheetURLExport();
  return (
    <>
      <button
        type="button"
        className={styles.menuBackdrop}
        onClick={onClose}
        aria-label="Close export menu"
        tabIndex={-1}
      />
      <div className={styles.exportMenu} role="menu">
        <a
          role="menuitem"
          className={styles.exportMenuItem}
          href={ics.href}
          download={ics.download}
          onClick={(event) => {
            ics.onClick(event);
            onClose();
          }}
        >
          <FiDownload size={13} aria-hidden="true" />
          Export .ics
        </a>
        <button
          type="button"
          role="menuitem"
          className={styles.exportMenuItem}
          onClick={() => {
            void exportURL();
            onClose();
          }}
        >
          <FiLink size={13} aria-hidden="true" />
          Copy URL
        </button>
      </div>
    </>
  );
}

function WorksheetList() {
  const {
    courses,
    viewedSeason,
    viewedWorksheetNumber,
    viewedWorksheetName,
    isReadonlyWorksheet,
    isExoticWorksheet,
    exoticWorksheet,
    isViewedWorksheetPrivate,
    viewedPerson,
    friends,
    worksheets,
    user,
    isAnonymousWorksheet,
    anonymousWorksheet,
    worksheetMissingSectionIds,
    isMobile,
    changeViewedSeason,
    setAllAnonymousWorksheetHidden,
    setAllActiveSavedWorksheetHidden,
    clearAnonymousWorksheet,
    clearActiveSavedWorksheet,
    activeSavedWorksheet,
    activeSavedWorksheetIdsByTerm,
    allTermSavedWorksheetSummaries,
    ensureMainSavedWorksheetForTerm,
    exitExoticWorksheet,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
      viewedWorksheetName: state.worksheetMemo.getViewedWorksheetName(state),
      isReadonlyWorksheet: state.worksheetMemo.getIsReadonlyWorksheet(state),
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exoticWorksheet: state.exoticWorksheet,
      isViewedWorksheetPrivate:
        state.worksheetMemo.getIsViewedWorksheetPrivate(state),
      viewedPerson: state.viewedPerson,
      friends: state.friends,
      worksheets: state.worksheets,
      user: state.user,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
      worksheetMissingSectionIds: state.worksheetMissingSectionIds,
      isMobile: state.isMobile,
      changeViewedSeason: state.changeViewedSeason,
      setAllAnonymousWorksheetHidden: state.setAllAnonymousWorksheetHidden,
      setAllActiveSavedWorksheetHidden: state.setAllActiveSavedWorksheetHidden,
      clearAnonymousWorksheet: state.clearAnonymousWorksheet,
      clearActiveSavedWorksheet: state.clearActiveSavedWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeSavedWorksheetIdsByTerm: state.activeSavedWorksheetIdsByTerm,
      allTermSavedWorksheetSummaries: state.allTermSavedWorksheetSummaries,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      exitExoticWorksheet: state.exitExoticWorksheet,
    })),
  );
  const worksheetsRefresh = useStore((state) => state.worksheetsRefresh);
  const seasonCodes = useWorksheetSeasonCodes();

  const [expandedCrns, setExpandedCrns] = useState<ReadonlySet<Crn>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [privateState, setPrivateState] = useState(isViewedWorksheetPrivate);
  const [updatingWSState, setUpdatingWSState] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showImportRow, setShowImportRow] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importTargetWorksheet, setImportTargetWorksheet] = useState(0);

  useEffect(() => {
    setExpandedCrns(new Set());
  }, [viewedSeason, viewedWorksheetNumber]);

  useEffect(() => {
    setPrivateState(isViewedWorksheetPrivate);
  }, [isViewedWorksheetPrivate]);

  const hasLegacyWorksheetAccount = isLegacyUserInfo(user);
  const hasSavedWorksheetAccount = Boolean(user && !hasLegacyWorksheetAccount);
  const canMutateCurrentWorksheet =
    isAnonymousWorksheet ||
    hasLegacyWorksheetAccount ||
    hasSavedWorksheetAccount;

  useEffect(() => {
    if (!isExoticWorksheet || !hasLegacyWorksheetAccount) {
      setShowImportRow(false);
      setImportTargetWorksheet(0);
    }
  }, [hasLegacyWorksheetAccount, isExoticWorksheet]);

  const { courseCount, credits } = getWorksheetCourseStats(courses);
  const areHidden = useMemo(
    () => courses.length > 0 && courses.every((course) => course.hidden),
    [courses],
  );
  const allExpanded =
    courses.length > 0 &&
    courses.every((course) => expandedCrns.has(course.crn));

  // The list shows every course (hidden included), so conflicts are detected
  // across the whole worksheet.
  const scheduleConflicts = useMemo(
    () => getScheduleConflicts(courses),
    [courses],
  );
  const conflictPairs = useMemo(
    () => summarizeConflictPairs(scheduleConflicts),
    [scheduleConflicts],
  );
  const conflictsByCrn = useMemo(
    () => groupConflictsByCrn(scheduleConflicts),
    [scheduleConflicts],
  );

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

  const showHideButton = canMutateCurrentWorksheet && !isReadonlyWorksheet;
  const showSettings =
    canMutateCurrentWorksheet &&
    !isExoticWorksheet &&
    viewedPerson === 'me' &&
    (!isAnonymousWorksheet || courses.length > 0);
  const showWorksheetPrivacySetting =
    !isAnonymousWorksheet && hasLegacyWorksheetAccount;
  const showImport =
    isExoticWorksheet && hasLegacyWorksheetAccount && !hasSavedWorksheetAccount;

  const importSeason = exoticWorksheet?.data.season ?? viewedSeason;
  const importWorksheetOptions = useWorksheetNumberOptions('me', importSeason);

  const pageTitle = isExoticWorksheet
    ? (exoticWorksheet?.data.name ?? 'Shared Worksheet')
    : viewedPerson === 'me'
      ? 'My Worksheet'
      : `${friends?.[viewedPerson]?.name ?? viewedPerson}'s Worksheet`;
  const pageSubtitleParts = isExoticWorksheet
    ? [
        toSeasonString(importSeason),
        exoticWorksheet?.data.creatorName
          ? `by ${exoticWorksheet.data.creatorName}`
          : '',
      ]
    : [toSeasonString(viewedSeason), viewedWorksheetName];
  const pageSubtitle = pageSubtitleParts.filter(Boolean).join(' · ');

  const toggleAllExpand = () => {
    setExpandedCrns(
      allExpanded ? new Set() : new Set(courses.map((course) => course.crn)),
    );
  };

  const toggleOneExpand = (crn: Crn) => {
    setExpandedCrns((previous) => {
      const next = new Set(previous);
      if (next.has(crn)) next.delete(crn);
      else next.add(crn);
      return next;
    });
  };

  const handleToggleAllHidden = async () => {
    if (isAnonymousWorksheet) {
      setAllAnonymousWorksheetHidden(!areHidden);
      return;
    }
    if (hasSavedWorksheetAccount) {
      await setAllActiveSavedWorksheetHidden(!areHidden);
      return;
    }
    await setCourseHidden({
      season: viewedSeason,
      worksheetNumber: viewedWorksheetNumber,
      crn: courses.map((course) => course.listing.crn),
      hidden: !areHidden,
    });
    await worksheetsRefresh();
  };

  const handleClearAll = async () => {
    if (courses.length === 0) return;
    const courseCnt = courses.length;

    if (isAnonymousWorksheet) {
      clearAnonymousWorksheet();
      setClearModalOpen(false);
      toast.success(
        courseCnt === 1
          ? 'Removed class from worksheet'
          : `Removed all ${courseCnt} classes from worksheet`,
      );
      return;
    }

    if (hasSavedWorksheetAccount) {
      setClearing(true);
      try {
        const cleared = await clearActiveSavedWorksheet();
        if (cleared) {
          setClearModalOpen(false);
          toast.success(
            courseCnt === 1
              ? 'Removed class from Saved Worksheet'
              : `Removed all ${courseCnt} classes from Saved Worksheet`,
          );
        }
      } finally {
        setClearing(false);
      }
      return;
    }

    const actions = courses.map((course) => ({
      action: 'remove' as const,
      season: viewedSeason,
      crn: course.listing.crn,
      worksheetNumber: viewedWorksheetNumber,
    }));

    setClearing(true);
    try {
      await updateWorksheetCourses(actions);
      await worksheetsRefresh();
      setClearModalOpen(false);
      toast.success(
        courseCnt === 1
          ? 'Removed class from worksheet'
          : `Removed all ${courseCnt} classes from worksheet`,
      );
    } finally {
      setClearing(false);
    }
  };

  const handleImport = async () => {
    if (isImporting) return;
    setIsImporting(true);

    const targetWorksheet = worksheets
      ?.get(importSeason)
      ?.get(importTargetWorksheet);

    if (courses.length === 0) {
      toast.error('Current worksheet has no courses to import');
      setIsImporting(false);
      return;
    }

    const actions = buildCourseImports(
      courses,
      importSeason,
      importTargetWorksheet,
      targetWorksheet,
    );

    if (actions.length === 0) {
      toast.success('All courses imported successfully');
      setIsImporting(false);
      setShowImportRow(false);
      return;
    }

    try {
      const success = await updateWorksheetCourses(actions);
      if (success) {
        await worksheetsRefresh();
        toast.success(
          `Imported ${actions.length} course${actions.length === 1 ? '' : 's'}`,
        );
        setShowImportRow(false);
      }
    } catch (error) {
      toast.error('Failed to import courses. Please try again.');
      console.error('Failed to import courses:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const warnings: string[] = [];
  if (worksheetMissingSectionIds.length > 0) {
    warnings.push(
      `${worksheetMissingSectionIds.length} ${
        isAnonymousWorksheet ? 'shared' : 'saved'
      } section${worksheetMissingSectionIds.length === 1 ? '' : 's'} no longer available in this snapshot.`,
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <p className={styles.pageSubtitle}>{pageSubtitle}</p>
        </div>
        {isExoticWorksheet && isMobile && (
          <Button variant="primary" size="sm" onClick={exitExoticWorksheet}>
            Exit
          </Button>
        )}
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <div className={styles.statTiles}>
            <div className={styles.statTile}>
              <div className={styles.statValue}>{courseCount}</div>
              <div className={styles.statLabel}>Courses</div>
            </div>
            <div className={styles.statTile}>
              <div className={styles.statValue}>{credits}</div>
              <div className={styles.statLabel}>Credits</div>
            </div>
          </div>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={toggleAllExpand}
              title={allExpanded ? 'Collapse all' : 'Expand all'}
              aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
            >
              <ExpandAllIcon allExpanded={allExpanded} />
            </button>
            {showHideButton && (
              <button
                type="button"
                className={styles.controlButton}
                onClick={() => {
                  void handleToggleAllHidden();
                }}
                title={areHidden ? 'Show all' : 'Hide all'}
                aria-label={`${areHidden ? 'Show' : 'Hide'} all`}
              >
                {areHidden ? (
                  <BsEyeSlash size={15} aria-hidden="true" />
                ) : (
                  <BsEye size={15} aria-hidden="true" />
                )}
              </button>
            )}
            {showSettings && (
              <button
                type="button"
                className={styles.controlButton}
                onClick={() => setSettingsModalOpen(true)}
                title="Worksheet Settings"
                aria-label="Worksheet Settings"
              >
                <FiSettings size={14} aria-hidden="true" />
              </button>
            )}
            <div className={styles.exportWrapper}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={() => setExportMenuOpen((open) => !open)}
                title="Export worksheet"
                aria-label="Export worksheet"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                <FiDownload size={13} aria-hidden="true" />
              </button>
              {exportMenuOpen && (
                <WorksheetExportMenu onClose={() => setExportMenuOpen(false)} />
              )}
            </div>
            {showImport && (
              <button
                type="button"
                className={styles.controlButton}
                onClick={() => setShowImportRow((open) => !open)}
                title="Import courses into your worksheet"
                aria-label="Import courses"
                aria-expanded={showImportRow}
              >
                <TbCalendarUp size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className={styles.warnings}>
            {warnings.map((warning) => (
              <div key={warning} className={styles.warning}>
                {warning}
              </div>
            ))}
          </div>
        )}

        {conflictPairs.length > 0 && (
          <div className={styles.conflictBox}>
            <div className={styles.conflictHeader}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {conflictPairs.length} schedule conflict
              {conflictPairs.length === 1 ? '' : 's'}
            </div>
            {conflictPairs.map((pair) => (
              <div key={pair.key} className={styles.conflictLine}>
                <span className={styles.conflictCodes}>
                  {pair.courseCodes[0]} ↔ {pair.courseCodes[1]}
                </span>
                <span className={styles.conflictMeta}>
                  {pair.details.join('; ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {showImportRow && (
          <div className={styles.importRow}>
            <span className={styles.importLabel}>Import into:</span>
            <DropdownButton
              size="sm"
              variant="outline-secondary"
              className={styles.importDropdown}
              title={
                <>
                  {WorksheetStatusIcon(
                    importTargetWorksheet,
                    importWorksheetOptions[importTargetWorksheet]?.isPrivate,
                  )}
                  <span className={styles.importDropdownTitle}>
                    {importWorksheetOptions[importTargetWorksheet]?.label ??
                      'Main Worksheet'}
                  </span>
                </>
              }
              onSelect={(key) => {
                if (key !== null) setImportTargetWorksheet(Number(key));
              }}
            >
              {Object.values(importWorksheetOptions).map((opt) => (
                <Dropdown.Item
                  key={opt.value}
                  eventKey={opt.value}
                  active={opt.value === importTargetWorksheet}
                >
                  {WorksheetStatusIcon(opt.value, opt.isPrivate)}
                  {opt.label}
                </Dropdown.Item>
              ))}
            </DropdownButton>
            <Button
              variant="primary"
              size="sm"
              disabled={isImporting}
              onClick={() => {
                void handleImport();
              }}
            >
              {isImporting ? 'Importing...' : 'Confirm'}
            </Button>
          </div>
        )}
      </div>

      {courses.length > 0 ? (
        <div className={styles.courseList}>
          {courses.map((course) => (
            <WorksheetListItem
              key={viewedSeason + course.crn}
              course={course}
              expanded={expandedCrns.has(course.crn)}
              conflicts={conflictsByCrn.get(course.crn) ?? []}
              onToggleExpand={() => toggleOneExpand(course.crn)}
            />
          ))}
        </div>
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

      <Modal
        show={settingsModalOpen}
        onHide={() => setSettingsModalOpen(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Worksheet Settings</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            {showWorksheetPrivacySetting &&
              (viewedWorksheetNumber === 0 ? (
                <OverlayTrigger
                  placement="right"
                  overlay={
                    <Tooltip id="worksheet-settings-private-disabled-tooltip">
                      Your main worksheet must always be public.
                    </Tooltip>
                  }
                >
                  <span style={{ display: 'inline-block' }}>
                    <Form.Check
                      type="switch"
                      id="private-worksheet-switch"
                      label="Private Worksheet"
                      checked={false}
                      disabled
                    />
                  </span>
                </OverlayTrigger>
              ) : (
                <Form.Check
                  type="switch"
                  id="private-worksheet-switch"
                  label="Private Worksheet"
                  checked={privateState}
                  onChange={() => setPrivateState(!privateState)}
                />
              ))}

            {courses.length > 0 && (
              <div className={showWorksheetPrivacySetting ? 'mt-4' : undefined}>
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
              </div>
            )}
          </Form>
        </Modal.Body>

        {showWorksheetPrivacySetting && (
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                if (privateState !== isViewedWorksheetPrivate) {
                  setUpdatingWSState(true);
                  (async () => {
                    await updateWorksheetMetadata({
                      season: viewedSeason,
                      action: 'setPrivate',
                      worksheetNumber: viewedWorksheetNumber,
                      private: privateState,
                    });
                    await worksheetsRefresh();
                  })()
                    .then(() => {
                      setUpdatingWSState(false);
                      setSettingsModalOpen(false);
                    })
                    .catch(() => {
                      setUpdatingWSState(false);
                    });
                }
              }}
              disabled={
                privateState === isViewedWorksheetPrivate || updatingWSState
              }
              style={{ minWidth: '4rem' }}
            >
              {updatingWSState ? (
                <div className="ms-auto">
                  <Spinner size="sm" />
                </div>
              ) : (
                'Save'
              )}
            </Button>
          </Modal.Footer>
        )}
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
            onClick={() => {
              void handleClearAll();
            }}
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

export default WorksheetList;
