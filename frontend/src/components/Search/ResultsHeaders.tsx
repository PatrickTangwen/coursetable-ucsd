import React from 'react';
import clsx from 'clsx';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { FaBars, FaTh } from 'react-icons/fa';

import ResultsColumnSort from './ResultsColumnSort';
import { type SortKeys, sortByOptions } from '../../search/searchTypes';
import { SurfaceComponent } from '../Typography';
import colStyles from './ResultsCols.module.css';
import styles from './ResultsHeaders.module.css';

function HeaderCol({
  className,
  children,
  tooltip,
  tooltipId,
  sortOption,
}: {
  readonly className: string | undefined;
  readonly children: React.ReactNode;
  readonly tooltip?: string | React.JSX.Element;
  readonly tooltipId?: string;
  readonly sortOption?: SortKeys;
}) {
  return (
    <span className={clsx(className, styles.headerCol, styles.oneLine)}>
      {tooltip ? (
        <OverlayTrigger
          placement="bottom"
          overlay={(props) => (
            <Tooltip
              id={tooltipId ?? `header-${sortOption ?? 'col'}-tooltip`}
              {...props}
            >
              {typeof tooltip === 'string' ? <span>{tooltip}</span> : tooltip}
            </Tooltip>
          )}
        >
          <span>{children}</span>
        </OverlayTrigger>
      ) : (
        <span>{children}</span>
      )}
      {sortOption && (
        <ResultsColumnSort selectOption={sortByOptions[sortOption]} />
      )}
    </span>
  );
}

function ResultsHeaders({
  multiSeasons,
  isListView,
  setIsListView,
  numResults,
  allowViewToggle,
}: {
  readonly multiSeasons: boolean;
  readonly isListView: boolean;
  readonly setIsListView: (isList: boolean) => void;
  readonly numResults: number;
  readonly allowViewToggle: boolean;
}) {
  return (
    <SurfaceComponent
      className={clsx('px-0 mx-0', styles.container)}
      data-tutorial="catalog-5"
    >
      <div className={styles.resultsHeaderContent}>
        <span className={colStyles.controlCol}>
          {allowViewToggle && (
            <button
              type="button"
              className={clsx(styles.toggle, 'd-flex m-auto')}
              onClick={() => setIsListView(!isListView)}
              aria-label={
                isListView ? 'Switch to grid view' : 'Switch to list view'
              }
            >
              {!isListView ? <FaBars size={15} /> : <FaTh size={15} />}
            </button>
          )}
        </span>
        {isListView ? (
          <>
            {multiSeasons && (
              <HeaderCol className={colStyles.seasonCol}>Season</HeaderCol>
            )}
            <HeaderCol
              className={colStyles.codeCol}
              tooltip="Course code and section"
              tooltipId="results-header-code-tooltip"
              sortOption="course_code"
            >
              Code
            </HeaderCol>
            <HeaderCol className={colStyles.titleCol} sortOption="title">
              Title
            </HeaderCol>
            <HeaderCol
              className={colStyles.profCol}
              tooltip="Instructor names from the UCSD Schedule of Classes"
              tooltipId="results-header-professors-tooltip"
            >
              Instructors
            </HeaderCol>
            <HeaderCol className={colStyles.skillAreaCol}>
              Skills/Areas
            </HeaderCol>
            <HeaderCol
              className={colStyles.meetCol}
              tooltip={
                <span>
                  Days of the Week and Times
                  <br />
                  (sort order based on day and starting time)
                </span>
              }
              tooltipId="results-header-meets-tooltip"
              sortOption="time"
            >
              Meets
            </HeaderCol>
            <HeaderCol className={colStyles.locCol} sortOption="location">
              Location
            </HeaderCol>
            <HeaderCol
              className={colStyles.addedCol}
              tooltip="Date the course was added to our catalog"
              tooltipId="results-header-added-tooltip"
              sortOption="added"
            >
              Added
            </HeaderCol>
          </>
        ) : (
          <div className={clsx(styles.headerCol, styles.resultsStat)}>
            {`Showing ${numResults} course${numResults === 1 ? '' : 's'}...`}
          </div>
        )}
      </div>
    </SurfaceComponent>
  );
}

export default ResultsHeaders;
