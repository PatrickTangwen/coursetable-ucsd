import { Col, Row } from 'react-bootstrap';

import type { CourseModalPrefetchListingDataFragment } from '../../../generated/graphql-types';
import type { UcsdCourseArchive } from '../../../queries/ucsdCatalogSnapshot';
import {
  to12HourTime,
  toWeekdaysDisplayString,
} from '../../../utilities/course';
import { ucsdMeetingTypeCode } from '../ucsdMeetingTypes';
import styles from './UcsdSnapshotOverview.module.css';

type PrefetchCourse = CourseModalPrefetchListingDataFragment['course'];
type RuntimeMeeting = PrefetchCourse['course_meetings'][number] & {
  readonly location?: {
    readonly room?: string | null;
    readonly building?: {
      readonly code?: string | null;
    } | null;
  } | null;
  readonly meeting_type?: string | null;
  readonly raw_location?: string | null;
};
type RuntimeCourse = Omit<
  PrefetchCourse,
  'course_professors' | 'course_meetings'
> & {
  readonly credits?: number | null;
  readonly course_professors: readonly {
    readonly professor: {
      readonly professor_id: number;
      readonly name?: string;
    };
  }[];
  readonly course_meetings: readonly RuntimeMeeting[];
};

function formatGpa(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(2);
}

function formatCompactGpa(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(1);
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function formatCompactPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function renderNumericCell(fullValue: string, compactValue = fullValue) {
  return (
    <td className={styles.numericCell} aria-label={fullValue} title={fullValue}>
      <span className={styles.fullCellValue}>{fullValue}</span>
      <span className={styles.compactCellValue} aria-hidden="true">
        {compactValue}
      </span>
    </td>
  );
}

const archiveQuarterRank: { [quarter: string]: number } = {
  WI: 1,
  WN: 1,
  SP: 2,
  S1: 3,
  SS1: 3,
  SU1: 3,
  S2: 4,
  SS2: 4,
  SU2: 4,
  S3: 5,
  SS: 5,
  SS3: 5,
  SU: 5,
  SU3: 5,
  FA: 6,
};

function archiveYearValue(year: string): number | null {
  const parsed = Number.parseInt(year.trim(), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 100 ? 2000 + parsed : parsed;
}

function compareArchiveTerm(
  a: UcsdCourseArchive['grade_archive_records'][number],
  b: UcsdCourseArchive['grade_archive_records'][number],
) {
  const yearA = archiveYearValue(a.year);
  const yearB = archiveYearValue(b.year);
  if (yearA !== null && yearB !== null && yearA !== yearB) return yearA - yearB;
  if (yearA !== null && yearB === null) return 1;
  if (yearA === null && yearB !== null) return -1;
  if (yearA === null && yearB === null) {
    const yearComparison = a.year.localeCompare(b.year, 'en-US', {
      numeric: true,
      sensitivity: 'base',
    });
    if (yearComparison !== 0) return yearComparison;
  }

  const quarterA = a.quarter.trim().toUpperCase();
  const quarterB = b.quarter.trim().toUpperCase();
  const rankA = archiveQuarterRank[quarterA] ?? 0;
  const rankB = archiveQuarterRank[quarterB] ?? 0;
  if (rankA !== rankB) return rankA - rankB;
  return quarterA.localeCompare(quarterB, 'en-US', {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortArchiveRecordsByTermDescending(
  records: UcsdCourseArchive['grade_archive_records'],
) {
  return [...records].sort((a, b) => compareArchiveTerm(b, a));
}

function professorText(course: RuntimeCourse): string {
  const names = course.course_professors
    .map(({ professor }) => professor.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : 'TBA';
}

function meetingTypeLabel(meetingType: string | null | undefined): string {
  return meetingType ? ucsdMeetingTypeCode(meetingType) : '';
}

function typedLine(meeting: RuntimeMeeting, value: string): string {
  const label = meetingTypeLabel(meeting.meeting_type);
  return label ? `${label}: ${value}` : value;
}

function uniqueLines(lines: string[]): string {
  return [...new Set(lines)].join('\n');
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}

function meetingText(course: RuntimeCourse): string {
  if (!course.course_meetings.length) return 'TBA';
  const lines = course.course_meetings
    .map((meeting) => {
      const value = `${toWeekdaysDisplayString(
        meeting.days_of_week,
      )} ${to12HourTime(meeting.start_time)}-${to12HourTime(meeting.end_time)}`;
      return typedLine(meeting, value);
    })
    .filter(isPresent);
  return uniqueLines(lines);
}

function locationText(course: RuntimeCourse): string {
  const locations = course.course_meetings
    .map((meeting) => {
      let value: string | null | undefined = meeting.raw_location;
      if (meeting.location?.building?.code) {
        const { code } = meeting.location.building;
        value = meeting.location.room
          ? `${code} ${meeting.location.room}`
          : code;
      }
      return value ? typedLine(meeting, value) : null;
    })
    .filter(isPresent);
  return locations.length ? uniqueLines(locations) : 'TBA';
}

function SnapshotMetadata({
  archive,
  listing,
}: {
  readonly archive: UcsdCourseArchive | null;
  readonly listing: CourseModalPrefetchListingDataFragment;
}) {
  const course = listing.course as RuntimeCourse;
  const rows = [
    { label: 'Professor', value: professorText(course) },
    { label: 'Meetings', value: meetingText(course) },
    { label: 'Location', value: locationText(course) },
    { label: 'Section', value: course.section },
    { label: 'Units', value: archive?.units ?? course.credits ?? 'N/A' },
    { label: 'Prerequisites', value: archive?.prerequisites_text },
    { label: 'Restrictions', value: archive?.restrictions_text },
    {
      label: 'Catalog Source',
      value: archive?.catalog_url ? (
        <a href={archive.catalog_url} rel="noopener noreferrer" target="_blank">
          {archive.catalog_url}
        </a>
      ) : null,
    },
  ].filter(({ value }) => value !== null && value !== '');

  return (
    <dl className={styles.metadataList}>
      {rows.map(({ label, value }) => (
        <div className={styles.metadataRow} key={label}>
          <dt className={styles.metadataLabel}>{label}</dt>
          <dd className={styles.metadataValue}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GradeArchiveRecords({
  archive,
}: {
  readonly archive: UcsdCourseArchive | null;
}) {
  const gradeArchiveRecords = archive
    ? sortArchiveRecordsByTermDescending(archive.grade_archive_records)
    : [];

  return (
    <>
      {!archive && (
        <p className={styles.missingData}>
          UCSD archive metadata is unavailable for this snapshot course.
          Historical GPA Data has not been published in the snapshot yet.
        </p>
      )}
      {archive && archive.grade_archive_records.length === 0 && (
        <p className={styles.missingData}>
          No UCSD Instructor Grade Archive records matched this snapshot course.
          Historical GPA Data may be unavailable for this course or term.
        </p>
      )}
      {archive && archive.grade_archive_records.length > 0 && (
        <div className={styles.recordTableFrame}>
          <table className={styles.recordTable}>
            <colgroup>
              <col className={styles.yearColumn} />
              <col className={styles.quarterColumn} />
              <col className={styles.instructorColumn} />
              <col className={styles.gpaColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
              <col className={styles.percentColumn} />
            </colgroup>
            <thead>
              <tr>
                <th aria-label="Year">
                  <span className={styles.fullHeaderLabel}>Year</span>
                  <span
                    className={styles.compactHeaderLabel}
                    aria-hidden="true"
                  >
                    Yr
                  </span>
                </th>
                <th aria-label="Quarter">
                  <span className={styles.fullHeaderLabel}>Quarter</span>
                  <span
                    className={styles.compactHeaderLabel}
                    aria-hidden="true"
                  >
                    Qtr
                  </span>
                </th>
                <th aria-label="Instructor">
                  <span className={styles.fullHeaderLabel}>Instructor</span>
                  <span
                    className={styles.compactHeaderLabel}
                    aria-hidden="true"
                  >
                    Instr
                  </span>
                </th>
                <th className={styles.numericCell}>GPA</th>
                <th className={styles.numericCell}>A</th>
                <th className={styles.numericCell}>B</th>
                <th className={styles.numericCell}>C</th>
                <th className={styles.numericCell}>D</th>
                <th className={styles.numericCell}>F</th>
                <th className={styles.numericCell}>W</th>
                <th className={styles.numericCell}>P</th>
                <th className={styles.numericCell}>NP</th>
              </tr>
            </thead>
            <tbody>
              {gradeArchiveRecords.map((record, index) => (
                <tr
                  key={`${record.subject}-${record.course}-${record.year}-${record.quarter}-${record.instructor ?? 'TBA'}-${index}`}
                >
                  <td>{record.year}</td>
                  <td>{record.quarter}</td>
                  <td>
                    <span
                      className={styles.instructorName}
                      title={record.instructor ?? 'TBA'}
                    >
                      {record.instructor ?? 'TBA'}
                    </span>
                  </td>
                  {renderNumericCell(
                    formatGpa(record.gpa),
                    formatCompactGpa(record.gpa),
                  )}
                  {renderNumericCell(
                    formatPercent(record.a),
                    formatCompactPercent(record.a),
                  )}
                  {renderNumericCell(
                    formatPercent(record.b),
                    formatCompactPercent(record.b),
                  )}
                  {renderNumericCell(
                    formatPercent(record.c),
                    formatCompactPercent(record.c),
                  )}
                  {renderNumericCell(
                    formatPercent(record.d),
                    formatCompactPercent(record.d),
                  )}
                  {renderNumericCell(
                    formatPercent(record.f),
                    formatCompactPercent(record.f),
                  )}
                  {renderNumericCell(
                    formatPercent(record.w),
                    formatCompactPercent(record.w),
                  )}
                  {renderNumericCell(
                    formatPercent(record.p),
                    formatCompactPercent(record.p),
                  )}
                  {renderNumericCell(
                    formatPercent(record.np),
                    formatCompactPercent(record.np),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function UcsdSnapshotPastGrades({
  archive,
}: {
  readonly archive: UcsdCourseArchive | null;
}) {
  return (
    <Row className="m-auto">
      <Col className="px-0">
        <GradeArchiveRecords archive={archive} />
      </Col>
    </Row>
  );
}

function UcsdSnapshotOverview({
  archive,
  listing,
}: {
  readonly archive: UcsdCourseArchive | null;
  readonly listing: CourseModalPrefetchListingDataFragment;
}) {
  return (
    <Row className="m-auto">
      <Col className="px-0">
        <p>{listing.course.description || 'No description available.'}</p>
        <SnapshotMetadata listing={listing} archive={archive} />
      </Col>
    </Row>
  );
}

export default UcsdSnapshotOverview;
