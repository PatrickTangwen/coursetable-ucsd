import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { GridChildComponentProps } from 'react-window';
import { useShallow } from 'zustand/react/shallow';

import type { ResultItemData } from './Results';
import {
  SeasonTag,
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
import { TextComponent } from '../Typography';
import WorksheetToggleButton from '../Worksheet/WorksheetToggleButton';
import styles from './ResultsGridItem.module.css';

function ResultsGridItem({
  data: { listings, columnCount, multiSeasons },
  rowIndex,
  columnIndex,
  style,
}: GridChildComponentProps<ResultItemData>) {
  const listing = listings[rowIndex * columnCount + columnIndex];
  const target = useCourseModalLink(listing);
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

  const inWorksheet = useMemo(
    () =>
      listing &&
      (isAnonymousWorksheet
        ? anonymousWorksheetHasListing(anonymousWorksheet, listing)
        : isInWorksheet(
            listing,
            getRelevantWorksheetNumber(listing.course.season_code),
            worksheets,
          )),
    [
      anonymousWorksheet,
      isAnonymousWorksheet,
      listing,
      getRelevantWorksheetNumber,
      worksheets,
    ],
  );

  if (!listing) return null;

  const archive = getUcsdArchive(listing);
  const timesSummary = toTimesSummary(listing.course);
  const locationsSummary = toLocationsSummary(listing.course, true);

  return (
    <li className={styles.container} style={style}>
      <Link
        to={target}
        className={clsx(
          styles.resultItem,
          inWorksheet && styles.inWorksheetResultItem,
          'px-3 pb-3',
        )}
      >
        <div className="d-flex justify-content-between">
          <div className={styles.courseCodes}>
            <CourseCode listing={listing} subdueSection={false} />
          </div>
          {multiSeasons && (
            <SeasonTag
              season={listing.course.season_code}
              className={styles.season}
            />
          )}
        </div>
        <div>
          <strong className={styles.oneLine}>{listing.course.title}</strong>
        </div>
        <div className="d-flex justify-content-between">
          <div className={styles.courseInfo}>
            <TextComponent
              type="secondary"
              className={clsx(styles.oneLine, styles.professors)}
            >
              {listing.course.course_professors.length > 0
                ? listing.course.course_professors
                    .map((p) => p.professor.name)
                    .join(' • ')
                : 'Professor: TBA'}
            </TextComponent>
            <TextComponent
              type="secondary"
              className={clsx(styles.oneLine, styles.smallText)}
            >
              {timesSummary === 'TBA' ? 'Times: TBA' : timesSummary}
            </TextComponent>
            <TextComponent
              type="secondary"
              className={clsx(styles.oneLine, styles.smallText)}
            >
              {locationsSummary === 'TBA'
                ? 'Location: TBA'
                : `Location: ${locationsSummary}`}
            </TextComponent>
            <div className={styles.skillsAreas}>
              {[...listing.course.skills, ...listing.course.areas].map(
                (skill) => (
                  <SkillBadge skill={skill} key={skill} />
                ),
              )}
            </div>
          </div>
          <div className={styles.archiveSummary}>
            <TextComponent type="secondary" className={styles.smallText}>
              Average GPA: {formatArchiveAvgGpa(archive?.archive_avg_gpa)}
            </TextComponent>
            <TextComponent type="secondary" className={styles.smallText}>
              Record Count:{' '}
              {formatArchiveRecordCount(archive?.archive_record_count)}
            </TextComponent>
          </div>
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

export default ResultsGridItem;
