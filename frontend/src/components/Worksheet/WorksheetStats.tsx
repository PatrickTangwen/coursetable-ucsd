import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button, Collapse } from 'react-bootstrap';
import chroma from 'chroma-js';
import { useShallow } from 'zustand/react/shallow';
import type {
  ExoticWorksheet,
  WorksheetCourse,
} from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import {
  getWorksheetConflicts,
  getWorksheetCourseStats,
} from '../../utilities/course';

import styles from './WorksheetStats.module.css';

function StatPill({
  colorMap,
  stat,
  children,
}: {
  readonly colorMap: chroma.Scale;
  readonly stat: number;
  readonly children: React.ReactNode;
}) {
  const theme = useStore((state) => state.theme);
  return (
    <dd
      className={styles.statPill}
      style={{
        backgroundColor: colorMap(stat)
          .alpha(theme === 'light' ? 1 : 0.75)
          .css(),
      }}
    >
      {children}
    </dd>
  );
}

const courseNumberColormap = chroma
  .scale(['#63b37b', '#ffeb84', '#f8696b'])
  .domain([4, 6]);
const creditColormap = chroma
  .scale(['#63b37b', '#ffeb84', '#f8696b'])
  .domain([4, 5.5]);

export default function WorksheetStats() {
  const {
    courses,
    isExoticWorksheet,
    exoticWorksheet,
    isAnonymousWorksheet,
    worksheetMissingSectionIds,
    exitExoticWorksheet,
    isMobile,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exoticWorksheet: state.exoticWorksheet,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      worksheetMissingSectionIds: state.worksheetMissingSectionIds,
      exitExoticWorksheet: state.exitExoticWorksheet,
      isMobile: state.isMobile,
    })),
  );
  const anonymousConflictSummaries = useMemo(() => {
    if (!isAnonymousWorksheet) return [];
    return getWorksheetConflicts(courses).map(
      ({ courses: [first, second] }) =>
        `${first.course_code} / ${second.course_code}`,
    );
  }, [courses, isAnonymousWorksheet]);

  return (
    <WorksheetStatsView
      courses={courses}
      isExoticWorksheet={isExoticWorksheet}
      exoticWorksheet={exoticWorksheet?.data}
      isAnonymousWorksheet={isAnonymousWorksheet}
      worksheetMissingSectionIds={worksheetMissingSectionIds}
      anonymousConflictSummaries={anonymousConflictSummaries}
      exitExoticWorksheet={exitExoticWorksheet}
      isMobile={isMobile}
    />
  );
}

export function WorksheetStatsView({
  courses,
  isExoticWorksheet,
  exoticWorksheet,
  isAnonymousWorksheet,
  worksheetMissingSectionIds,
  anonymousConflictSummaries,
  exitExoticWorksheet,
  isMobile,
}: {
  readonly courses: WorksheetCourse[];
  readonly isExoticWorksheet: boolean;
  readonly exoticWorksheet: ExoticWorksheet | undefined;
  readonly isAnonymousWorksheet: boolean;
  readonly worksheetMissingSectionIds: string[];
  readonly anonymousConflictSummaries: string[];
  readonly exitExoticWorksheet: () => void;
  readonly isMobile: boolean;
}) {
  const [shown, setShown] = useState(true);
  const { courseCount: courseCnt, credits } = getWorksheetCourseStats(courses);

  return (
    <div className={clsx(shown ? 'dropdown' : 'dropup', styles.statsContainer)}>
      <div className={styles.toggleButton}>
        <button
          type="button"
          className="dropdown-toggle"
          onClick={() => setShown(!shown)}
        >
          Summary
        </button>
      </div>
      <Collapse in={shown}>
        <div>
          <div className={styles.stats}>
            {isExoticWorksheet && exoticWorksheet && (
              <div className={styles.worksheetInfo}>
                <div className={styles.worksheetName}>
                  {exoticWorksheet.name}
                </div>
                {exoticWorksheet.creatorName && (
                  <div className={styles.creatorName}>
                    by {exoticWorksheet.creatorName}
                  </div>
                )}
              </div>
            )}
            {isAnonymousWorksheet &&
              (worksheetMissingSectionIds.length > 0 ||
                anonymousConflictSummaries.length > 0) && (
                <div className={styles.worksheetInfo}>
                  {worksheetMissingSectionIds.length > 0 && (
                    <div className={styles.creatorName}>
                      {worksheetMissingSectionIds.length} shared section
                      {worksheetMissingSectionIds.length === 1 ? '' : 's'} no
                      longer available in this snapshot.
                    </div>
                  )}
                  {anonymousConflictSummaries.length > 0 && (
                    <div className={styles.creatorName}>
                      {anonymousConflictSummaries.length} schedule conflict
                      {anonymousConflictSummaries.length === 1 ? '' : 's'}:{' '}
                      {anonymousConflictSummaries.slice(0, 3).join('; ')}
                      {anonymousConflictSummaries.length > 3
                        ? `; +${anonymousConflictSummaries.length - 3} more`
                        : ''}
                    </div>
                  )}
                </div>
              )}
            {!isAnonymousWorksheet && worksheetMissingSectionIds.length > 0 && (
              <div className={styles.worksheetInfo}>
                <div className={styles.creatorName}>
                  {worksheetMissingSectionIds.length} saved section
                  {worksheetMissingSectionIds.length === 1 ? '' : 's'} no longer
                  available in this snapshot.
                </div>
              </div>
            )}
            <dl>
              <div>
                <dt>Total courses</dt>
                <StatPill colorMap={courseNumberColormap} stat={courseCnt}>
                  {courseCnt}
                </StatPill>
              </div>
              <div>
                <dt>Total credits</dt>
                <StatPill colorMap={creditColormap} stat={credits}>
                  {credits}
                </StatPill>
              </div>
            </dl>
            {isExoticWorksheet && isMobile && (
              <>
                <div className={styles.spacer} />
                <dl>
                  <div className={styles.wide}>
                    <dt>Viewing exported worksheet</dt>
                    <Button variant="primary" onClick={exitExoticWorksheet}>
                      Exit
                    </Button>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}
