import { Col, Row } from 'react-bootstrap';

import type { CourseModalPrefetchListingDataFragment } from '../../../generated/graphql-types';
import type { UcsdCourseArchive } from '../../../queries/ucsdCatalogSnapshot';
import {
  to12HourTime,
  toWeekdaysDisplayString,
} from '../../../utilities/course';
import styles from './UcsdSnapshotOverview.module.css';

type RuntimeCourse = Omit<
  CourseModalPrefetchListingDataFragment['course'],
  'course_professors'
> & {
  readonly requirements?: string | null;
  readonly credits?: number | null;
  readonly course_professors: readonly {
    readonly professor: {
      readonly professor_id: number;
      readonly name?: string;
    };
  }[];
};

function formatGpa(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function professorText(course: RuntimeCourse): string {
  const names = course.course_professors
    .map(({ professor }) => professor.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : 'TBA';
}

function meetingText(course: RuntimeCourse): string {
  if (!course.course_meetings.length) return 'TBA';
  return course.course_meetings
    .map(
      (meeting) =>
        `${toWeekdaysDisplayString(meeting.days_of_week)} ${to12HourTime(
          meeting.start_time,
        )}-${to12HourTime(meeting.end_time)}`,
    )
    .join(', ');
}

function SnapshotMetadata({
  listing,
}: {
  readonly listing: CourseModalPrefetchListingDataFragment;
}) {
  const course = listing.course as RuntimeCourse;
  const rows = [
    ['Professor', professorText(course)],
    ['Meetings', meetingText(course)],
    ['Section', course.section],
    ['Credits', course.credits ?? 'N/A'],
    ['Requirements', course.requirements],
  ].filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );

  return (
    <dl className={styles.metadataList}>
      {rows.map(([label, value]) => (
        <div className={styles.metadataRow} key={String(label)}>
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
  readonly archive: UcsdCourseArchive;
}) {
  if (!archive.grade_archive_records.length) return null;

  return (
    <>
      <h3 className={styles.sectionTitle}>Grade Archive Records</h3>
      <div className="table-responsive">
        <table
          className={['table', 'table-sm', 'table-striped', styles.recordTable]
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
            {archive.grade_archive_records.map((record, index) => (
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
    </>
  );
}

function UcsdSnapshotOverview({
  archive,
  listing,
}: {
  readonly archive: UcsdCourseArchive;
  readonly listing: CourseModalPrefetchListingDataFragment;
}) {
  return (
    <Row className="m-auto">
      <Col className="px-0">
        <p>{listing.course.description || 'No description available.'}</p>
        <SnapshotMetadata listing={listing} />
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Archive Avg GPA</span>
            <span className={styles.summaryValue}>
              {formatGpa(archive.archive_avg_gpa)}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Record Count</span>
            <span className={styles.summaryValue}>
              {archive.archive_record_count}
            </span>
          </div>
        </div>
        <GradeArchiveRecords archive={archive} />
      </Col>
    </Row>
  );
}

export default UcsdSnapshotOverview;
