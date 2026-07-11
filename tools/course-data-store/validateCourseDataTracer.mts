import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import postgres from 'postgres';

import { applyHasuraMetadata } from './applyHasuraMetadata.mjs';
import { importSnapshot } from './importSnapshot.mjs';
import { migrateCourseDataStore } from './migrateCourseDataStore.mjs';

const execFileAsync = promisify(execFile);

function tracerPort(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535)
    throw new Error(`env config ${name} must be a valid port`);
  return value;
}

const tracer = {
  project: process.env.COURSE_DATA_TRACER_PROJECT ?? 'course-data-tracer',
  databasePort: tracerPort('COURSE_DATA_STORE_PORT', 55_489),
  hasuraPort: tracerPort('COURSE_DATA_HASURA_PORT', 18_089),
  password: randomBytes(24).toString('hex'),
  adminSecret: randomBytes(24).toString('hex'),
  term: 'S326',
  expectedCourses: 119,
  snapshotPath: 'api/static/catalogs/public/S326.json',
};
const databaseUrl = `postgresql://course_data:${tracer.password}@localhost:${tracer.databasePort}/course_data`;
const hasuraEndpoint = `http://localhost:${tracer.hasuraPort}`;

function composeArgs(args: string[]) {
  return [
    'compose',
    '-f',
    'course-data-store/compose.yml',
    '-p',
    tracer.project,
    ...args,
  ];
}

function compose(args: string[]) {
  return execFileAsync('docker', composeArgs(args), {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: {
      ...process.env,
      COURSE_DATA_STORE_PORT: String(tracer.databasePort),
      COURSE_DATA_HASURA_PORT: String(tracer.hasuraPort),
      COURSE_DATA_STORE_PASSWORD: tracer.password,
      COURSE_DATA_HASURA_ADMIN_SECRET: tracer.adminSecret,
    },
  });
}

async function queryAnonymous(query: string) {
  const response = await fetch(`${hasuraEndpoint}/v1/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return (await response.json()) as {
    data?: { supportedTerms?: unknown[] };
    errors?: unknown[];
  };
}

export async function validateCourseDataTracer() {
  let succeeded = false;
  try {
    await compose(['up', '-d', '--wait', '--remove-orphans']);
    await migrateCourseDataStore(databaseUrl);

    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'course-data-tracer-'),
    );
    const invalidSnapshot = path.join(temporaryDirectory, 'invalid.json');
    await writeFile(invalidSnapshot, JSON.stringify({ courses: [] }));
    await importSnapshot(invalidSnapshot, databaseUrl).then(
      () => {
        throw new Error('Invalid Snapshot was accepted');
      },
      (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes('is invalid'))
          throw error;
      },
    );

    const firstImport = await importSnapshot(tracer.snapshotPath, databaseUrl);
    const secondImport = await importSnapshot(tracer.snapshotPath, databaseUrl);
    if (firstImport.courses.created !== tracer.expectedCourses)
      throw new Error('Tracer did not create the expected Course count');
    if (
      secondImport.courses.created !== 0 ||
      secondImport.courses.unchanged !== tracer.expectedCourses ||
      secondImport.importRun !== 'unchanged'
    )
      throw new Error('Tracer import was not idempotent');

    const conflictingSnapshotPath = path.join(
      temporaryDirectory,
      'conflicting.json',
    );
    const conflictingSnapshot = JSON.parse(
      await readFile(tracer.snapshotPath, 'utf8'),
    ) as { run_id: string; courses: { title: string }[] };
    conflictingSnapshot.run_id += '-conflict';
    const [firstCourse] = conflictingSnapshot.courses;
    if (!firstCourse) throw new Error('Tracer Snapshot has no Courses');
    firstCourse.title += ' changed';
    await writeFile(
      conflictingSnapshotPath,
      JSON.stringify(conflictingSnapshot),
    );
    await importSnapshot(conflictingSnapshotPath, databaseUrl).then(
      () => {
        throw new Error('Conflicting Snapshot artifact was accepted');
      },
      (error: unknown) => {
        if (
          !(error instanceof Error) ||
          !error.message.includes('different accepted artifact')
        )
          throw error;
      },
    );

    await applyHasuraMetadata(hasuraEndpoint, tracer.adminSecret);
    const result = await queryAnonymous(`
      query CourseDataTracer {
        supportedTerms(where: {termCode: {_eq: "${tracer.term}"}}) {
          termCode
          termLabel
          courses(order_by: {courseId: asc}) {
            courseId
            subject
            courseNumber
            title
          }
        }
      }
    `);
    const terms = result.data?.supportedTerms as
      | { termCode: string; courses: unknown[] }[]
      | undefined;
    if (
      result.errors ||
      terms?.length !== 1 ||
      terms[0]?.termCode !== tracer.term
    )
      throw new Error('Anonymous Supported Term query failed');
    if (terms[0].courses.length !== tracer.expectedCourses)
      throw new Error('Anonymous Course query returned the wrong count');

    const privateQuery = await queryAnonymous('{ appUsers { id } }');
    if (!privateQuery.errors)
      throw new Error('App DB data appeared in Course Data Store GraphQL');
    const mutation = await queryAnonymous(`
      mutation AnonymousCourseMutation {
        insert_courses_one(object: {
          termCode: "${tracer.term}",
          courseId: "INVALID:0",
          subject: "INVALID",
          courseNumber: "0",
          title: "Invalid"
        }) { courseId }
      }
    `);
    if (!mutation.errors)
      throw new Error('Anonymous Course Data Store mutation was allowed');

    const sql = postgres(databaseUrl, { max: 1 });
    try {
      const [counts] = await sql<
        { courses: number; runs: number; terms: number }[]
      >`
        select
          (select count(*)::int from courses) as courses,
          (select count(*)::int from import_runs) as runs,
          (select count(*)::int from supported_terms) as terms
      `;
      if (
        counts?.courses !== tracer.expectedCourses ||
        counts.runs !== 1 ||
        counts.terms !== 1
      )
        throw new Error('Course Data Store counts were not idempotent');
    } finally {
      await sql.end();
    }

    succeeded = true;
    return {
      result: 'passed',
      term: tracer.term,
      courses: tracer.expectedCourses,
      importRuns: 1,
      anonymousRead: true,
      anonymousWriteDenied: true,
      appDbExcluded: true,
      idempotent: true,
    };
  } finally {
    await compose(['down', '--volumes', '--remove-orphans']).catch(() => {
      if (succeeded) throw new Error('Course Data tracer cleanup failed');
    });
  }
}

if (import.meta.main)
  console.log(JSON.stringify(await validateCourseDataTracer(), null, 2));
