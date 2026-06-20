import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { ListChildComponentProps } from 'react-window';
import { useShallow } from 'zustand/react/shallow';

import type { ResultItemData } from './Results';
import {
  SeasonTag,
  CourseInfoPopover,
  CourseCode,
  formatArchiveAvgGpa,
  formatArchiveRecordCount,
  getUcsdArchive,
} from './ResultsItemCommon';
import { useStore } from '../../store';
import { anonymousWorksheetHasListing } from '../../utilities/anonymousWorksheet';
import {
  isInWorksheet,
  toTimesSummary,
  toLocationsSummary,
} from '../../utilities/course';
import { useCourseModalLink } from '../../utilities/display';
import SkillBadge from '../SkillBadge';
import WorksheetToggleButton from '../Worksheet/WorksheetToggleButton';
import colStyles from './ResultsCols.module.css';
import styles from './ResultsItem.module.css';

function ResultsItem({
  data: { listings, multiSeasons },
  index,
  style,
}: ListChildComponentProps<ResultItemData>) {
  const listing = listings[index]!;
  const { worksheets, isAnonymousWorksheet, anonymousWorksheet } = useStore(
    useShallow((state) => ({
      worksheets: state.worksheets,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      anonymousWorksheet: state.anonymousWorksheet,
    })),
  );
  const getRelevantWorksheetNumber = useStore(
    (state) => state.getRelevantWorksheetNumber,
  );

  const archive = getUcsdArchive(listing);
  const target = useCourseModalLink(listing);

  const inWorksheet = useMemo(
    () =>
      isAnonymousWorksheet
        ? anonymousWorksheetHasListing(anonymousWorksheet, listing)
        : isInWorksheet(
            listing,
            getRelevantWorksheetNumber(listing.course.season_code),
            worksheets,
          ),
    [
      anonymousWorksheet,
      isAnonymousWorksheet,
      listing,
      getRelevantWorksheetNumber,
      worksheets,
    ],
  );

  const timeAdded = listing.course.time_added
    ? new Date(listing.course.time_added as string).toLocaleDateString()
    : '';

  return (
    <li className={styles.container} style={style}>
      <Link
        to={target}
        className={clsx(
          styles.resultItem,
          inWorksheet && styles.inWorksheetResultItem,
          index % 2 === 1 ? styles.oddResultItem : styles.evenResultItem,
          listing.course.extra_info !== 'ACTIVE' && styles.cancelledClass,
        )}
      >
        <div className={styles.resultItemContent}>
          <span
            className={colStyles.controlCol}
            data-tutorial={index === 0 && 'catalog-6'}
          />
          {multiSeasons && (
            <span className={colStyles.seasonCol}>
              <SeasonTag
                season={listing.course.season_code}
                className={styles.season}
              />
            </span>
          )}
          <span className={colStyles.codeCol}>
            <span className={clsx(styles.ellipsisText, 'fw-bold')}>
              <CourseCode listing={listing} subdueSection />
            </span>
          </span>
          <CourseInfoPopover listing={listing}>
            <span className={colStyles.titleCol}>
              <span className={styles.ellipsisText}>
                {listing.course.title}
              </span>
            </span>
          </CourseInfoPopover>
          <span className={colStyles.archiveGpaCol}>
            <span className={styles.ellipsisText}>
              {formatArchiveAvgGpa(archive?.archive_avg_gpa)}
            </span>
          </span>
          <span className={colStyles.archiveCountCol}>
            <span className={styles.ellipsisText}>
              {formatArchiveRecordCount(archive?.archive_record_count)}
            </span>
          </span>
          <span
            className={clsx('d-flex align-items-center', colStyles.profCol)}
          >
            <span className={styles.ellipsisText}>
              {listing.course.course_professors.length === 0
                ? 'TBA'
                : listing.course.course_professors
                    .map((p) => p.professor.name)
                    .join(' • ')}
            </span>
          </span>
          <span className={clsx('d-flex', colStyles.skillAreaCol)}>
            <span className={styles.skillsAreas}>
              {[...listing.course.skills, ...listing.course.areas].map(
                (skill) => (
                  <SkillBadge skill={skill} className="my-auto" key={skill} />
                ),
              )}
            </span>
          </span>
          <span className={colStyles.meetCol}>
            <span className={styles.ellipsisText}>
              {toTimesSummary(listing.course)}
            </span>
          </span>
          <span className={colStyles.locCol}>
            <span className={styles.ellipsisText}>
              {toLocationsSummary(listing.course, true)}
            </span>
          </span>
          <span className={colStyles.addedCol}>
            <span className={styles.ellipsisText}>{timeAdded}</span>
          </span>
        </div>
      </Link>
      {/* Don't this inside the link because interactive elements can't be
        nested */}
      <div className={styles.worksheetBtn}>
        <WorksheetToggleButton
          listing={listing}
          modal={false}
          inWorksheet={inWorksheet}
        />
      </div>
    </li>
  );
}

export default ResultsItem;
