import { Col, Row } from 'react-bootstrap';

import type { CourseModalPrefetchListingDataFragment } from '../../../generated/graphql-types';
import type { UcsdCourseArchive } from '../../../queries/ucsdCatalogSnapshot';
import {
  to12HourTime,
  toWeekdaysDisplayString,
} from '../../../utilities/course';
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

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
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
  const normalized = meetingType?.trim().toLowerCase();
  if (!normalized) return '';
  switch (normalized) {
    case 'lecture':
      return 'LE';
    case 'discussion':
      return 'DI';
    case 'laboratory':
    case 'lab':
      return 'LA';
    default:
      return meetingType?.trim() ?? '';
  }
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
        <div className="table-responsive">
          <table
            className={[
              'table',
              'table-sm',
              'table-striped',
              styles.recordTable,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <thead>
              <tr>
                <th>Year</th>
                <th>Quarter</th>
                <th>Instructor</th>
                <th>GPA</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>F</th>
                <th>W</th>
                <th>P</th>
                <th>NP</th>
              </tr>
            </thead>
            <tbody>
              {gradeArchiveRecords.map((record, index) => (
                <tr
                  key={`${record.subject}-${record.course}-${record.year}-${record.quarter}-${record.instructor ?? 'TBA'}-${index}`}
                >
                  <td>{record.year}</td>
                  <td>{record.quarter}</td>
                  <td>{record.instructor ?? 'TBA'}</td>
                  <td>{formatGpa(record.gpa)}</td>
                  <td>{formatPercent(record.a)}</td>
                  <td>{formatPercent(record.b)}</td>
                  <td>{formatPercent(record.c)}</td>
                  <td>{formatPercent(record.d)}</td>
                  <td>{formatPercent(record.f)}</td>
                  <td>{formatPercent(record.w)}</td>
                  <td>{formatPercent(record.p)}</td>
                  <td>{formatPercent(record.np)}</td>
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
