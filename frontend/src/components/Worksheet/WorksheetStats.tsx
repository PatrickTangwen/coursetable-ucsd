import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button, Collapse, OverlayTrigger, Tooltip } from 'react-bootstrap';
import chroma from 'chroma-js';
import { useShallow } from 'zustand/react/shallow';
import SavedWorksheetRestorePanel from './SavedWorksheetRestorePanel';
import SavedWorksheetSavePanel from './SavedWorksheetSavePanel';
import { useStore } from '../../store';
import {
  getWorksheetConflicts,
  isDiscussionSection,
} from '../../utilities/course';
import SkillBadge from '../SkillBadge';

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
  const [shown, setShown] = useState(true);
  const [savedWorksheetRefreshKey, setSavedWorksheetRefreshKey] = useState(0);
  const {
    courses,
    isExoticWorksheet,
    exoticWorksheet,
    isAnonymousWorksheet,
    anonymousWorksheetMissingSectionIds,
    exitExoticWorksheet,
    isMobile,
  } = useStore(
    useShallow((state) => ({
      courses: state.courses,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exoticWorksheet: state.exoticWorksheet,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheetMissingSectionIds:
        state.anonymousWorksheetMissingSectionIds,
      exitExoticWorksheet: state.exitExoticWorksheet,
      isMobile: state.isMobile,
    })),
  );
  const countedCourseCodes = new Set();
  let courseCnt = 0;
  let credits = 0;
  const skillsAreas: { courseCode: string; label: string }[] = [];
  const anonymousConflictSummaries = useMemo(() => {
    if (!isAnonymousWorksheet) return [];
    return getWorksheetConflicts(courses).map(
      ({ courses: [first, second] }) =>
        `${first.course_code} / ${second.course_code}`,
    );
  }, [courses, isAnonymousWorksheet]);

  for (const { listing, hidden } of courses) {
    const alreadyCounted = listing.course.listings.some((l) =>
      countedCourseCodes.has(l.course_code),
    );

    // Don't count in one of the following cases:
    // - Cross-listing has been counted
    // - Another section has been counted (we just randomly pick one)
    // - Is discussion section
    // - Is hidden
    if (alreadyCounted || hidden || isDiscussionSection(listing.course))
      continue;

    // Mark codes as counted, no double counting
    listing.course.listings.forEach((l) => {
      countedCourseCodes.add(l.course_code);
    });
    courseCnt++;
    credits += listing.course.credits ?? 0;
    skillsAreas.push(
      ...[...listing.course.skills, ...listing.course.areas].map((x) => ({
        courseCode: listing.course_code,
        label: x,
      })),
    );
  }

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
            {isExoticWorksheet && exoticWorksheet?.data && (
              <div className={styles.worksheetInfo}>
                <div className={styles.worksheetName}>
                  {exoticWorksheet.data.name}
                </div>
                {exoticWorksheet.data.creatorName && (
                  <div className={styles.creatorName}>
                    by {exoticWorksheet.data.creatorName}
                  </div>
                )}
              </div>
            )}
            {isAnonymousWorksheet && (
              <div className={styles.worksheetInfo}>
                <div className={styles.worksheetName}>Anonymous Worksheet</div>
                {anonymousWorksheetMissingSectionIds.length > 0 && (
                  <div className={styles.creatorName}>
                    {anonymousWorksheetMissingSectionIds.length} shared section
                    {anonymousWorksheetMissingSectionIds.length === 1
                      ? ''
                      : 's'}{' '}
                    no longer available in this snapshot.
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
                <SavedWorksheetSavePanel
                  onSaved={() => setSavedWorksheetRefreshKey((key) => key + 1)}
                />
                <SavedWorksheetRestorePanel
                  refreshKey={savedWorksheetRefreshKey}
                />
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
              <div className={styles.wide}>
                <dt>Skills & Areas</dt>
                <dd>
                  {skillsAreas
                    .sort((a, b) => a.label.localeCompare(b.label, 'en-US'))
                    .map((x, i) => (
                      <OverlayTrigger
                        key={i}
                        overlay={
                          <Tooltip id={`worksheet-stats-skill-${i}-tooltip`}>
                            {x.courseCode}
                          </Tooltip>
                        }
                      >
                        <span>
                          <SkillBadge skill={x.label} />
                        </span>
                      </OverlayTrigger>
                    ))}
                </dd>
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
