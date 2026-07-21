import clsx from 'clsx';

import { sortArchiveRecordsByTermDescending } from './ucsdSnapshotModalData';
import type { CoursePlanningPastGrade } from '../../queries/coursePlanningViewModels';
import styles from './UcsdSnapshotGradeDistribution.module.css';

type GradeRecord = CoursePlanningPastGrade;

const gradeColumns = [
  ['A', 'a'],
  ['B', 'b'],
  ['C', 'c'],
  ['D', 'd'],
  ['F', 'f'],
  ['W', 'w'],
  ['P', 'p'],
  ['NP', 'np'],
] as const;

function termCode(record: GradeRecord): string {
  const quarter = record.quarter.trim().toUpperCase();
  const year = record.year.trim();
  return `${quarter}${year.slice(-2)}`;
}

function gpaClass(gpa: number | null): string {
  if (gpa === null) return styles.gpaMissing!;
  if (gpa >= 3.5) return styles.gpaHigh!;
  if (gpa >= 3.3) return styles.gpaGood!;
  if (gpa >= 3) return styles.gpaMid!;
  return styles.gpaLow!;
}

export function displayedArchiveGpa(record: GradeRecord): number | null {
  if (record.gpa === null) return null;
  if (record.gpa !== 0) return record.gpa;

  const letterGradePercentages = [
    record.a,
    record.b,
    record.c,
    record.d,
    record.f,
  ];
  const hasLetterGrade = letterGradePercentages.some(
    (percentage) => percentage !== null && percentage > 0,
  );
  const hasPassNoPassGrade =
    (record.p !== null && record.p > 0) ||
    (record.np !== null && record.np > 0);

  return !hasLetterGrade && hasPassNoPassGrade ? null : record.gpa;
}

export default function UcsdSnapshotGradeDistribution({
  records: unsortedRecords,
}: {
  readonly records: CoursePlanningPastGrade[];
}) {
  const records = sortArchiveRecordsByTermDescending(unsortedRecords);
  if (records.length === 0) {
    return (
      <div className={styles.emptyCard}>
        No UCSD Instructor Grade Archive records matched this snapshot course.
        Historical GPA Data may be unavailable for this course or term.
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>Grade Distribution</div>
          <div className={styles.cardSubtitle}>
            {records.length} {records.length === 1 ? 'term' : 'terms'} on record
          </div>
        </div>
        <div className={styles.cardNote}>% of enrolled by grade</div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.termColumn} />
            <col className={styles.instructorColumn} />
            <col className={styles.gpaColumn} />
            {gradeColumns.map(([letter]) => (
              <col key={letter} className={styles.gradeColumn} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={styles.termHeader}>Term</th>
              <th className={styles.instructorHeader}>Instructor</th>
              <th>GPA</th>
              {gradeColumns.map(([letter], index) => (
                <th
                  key={letter}
                  className={clsx(
                    index === gradeColumns.length - 1 && styles.lastHeader,
                  )}
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const displayedGpa = displayedArchiveGpa(record);
              return (
                <tr
                  key={`${record.subject}-${record.course}-${record.year}-${record.quarter}-${record.instructor ?? 'TBA'}-${index}`}
                >
                  <td className={styles.termCell}>
                    <span className={styles.termBadge}>{termCode(record)}</span>
                  </td>
                  <td
                    className={styles.instructorCell}
                    title={record.instructor ?? 'TBA'}
                  >
                    {record.instructor ?? 'TBA'}
                  </td>
                  <td className={styles.gpaCell}>
                    <span
                      className={clsx(styles.gpaBadge, gpaClass(displayedGpa))}
                    >
                      {displayedGpa === null ? 'N/A' : displayedGpa.toFixed(2)}
                    </span>
                  </td>
                  {gradeColumns.map(([letter, field], columnIndex) => {
                    const value = record[field];
                    return (
                      <td
                        key={letter}
                        className={clsx(
                          styles.percentCell,
                          value === null && styles.percentMissing,
                          columnIndex === gradeColumns.length - 1 &&
                            styles.lastCell,
                        )}
                      >
                        {value === null ? '—' : value.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
