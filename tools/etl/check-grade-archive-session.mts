/**
 * Verifies that the operator's Instructor Grade Archive session still works:
 * runs one authenticated archive query and reports the parsed row count, or
 * the Single Sign-On redirect that means the cookie must be refreshed.
 *
 * Usage:
 *   bun tools/etl/check-grade-archive-session.mts
 *     [--grade-archive-session <file>] [--subject CSE]
 */

import {
  defaultInstructorGradeArchiveSessionPath,
  loadInstructorGradeArchiveSession,
} from './gradeArchiveSession.js';
import {
  fetchInstructorGradeArchiveForSubject,
  withInstructorGradeArchiveSession,
} from '../catalog-snapshot/instructorGradeArchive.js';

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

const sessionPath = argument(
  '--grade-archive-session',
  defaultInstructorGradeArchiveSessionPath,
);
const subject = argument('--subject', 'CSE');

try {
  const cookie = await loadInstructorGradeArchiveSession(sessionPath);
  if (!cookie) {
    console.error(`No session file at ${sessionPath}`);
    process.exitCode = 1;
  } else {
    const records = await fetchInstructorGradeArchiveForSubject(subject, {
      fetch: withInstructorGradeArchiveSession(cookie),
    });
    console.log(
      `Instructor Grade Archive session OK: ${records.length} ${subject} rows via ${sessionPath}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
