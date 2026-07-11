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
  expectedSections: 275,
  expectedMeetings: 353,
  expectedInstructors: 204,
  expectedInstructorLinks: 279,
  snapshotPath: 'api/static/catalogs/public/S326.json',
  zeroMeetingFixture:
    'tools/course-data-store/fixtures/zero-meeting-snapshot.json',
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
    data?: { [key: string]: unknown };
    errors?: unknown[];
  };
}

async function acceptedTermCounts() {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [counts] = await sql<
      { courses: number; meetings: number; sections: number }[]
    >`
      select
        (select count(*)::int from courses where term_code = ${tracer.term}) as courses,
        (select count(*)::int from sections where term_code = ${tracer.term}) as sections,
        (select count(*)::int from meetings where term_code = ${tracer.term}) as meetings
    `;
    return counts;
  } finally {
    await sql.end();
  }
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
      firstImport.sections.created !== tracer.expectedSections ||
      firstImport.meetings.created !== tracer.expectedMeetings ||
      firstImport.instructors.created !== tracer.expectedInstructors ||
      firstImport.instructorLinks.created !== tracer.expectedInstructorLinks
    )
      throw new Error('Tracer did not create the expected relationship counts');
    if (
      secondImport.courses.created !== 0 ||
      secondImport.courses.unchanged !== tracer.expectedCourses ||
      secondImport.sections.unchanged !== tracer.expectedSections ||
      secondImport.meetings.unchanged !== tracer.expectedMeetings ||
      secondImport.instructors.unchanged !== tracer.expectedInstructors ||
      secondImport.instructorLinks.unchanged !==
        tracer.expectedInstructorLinks ||
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

    const zeroMeetingImport = await importSnapshot(
      tracer.zeroMeetingFixture,
      databaseUrl,
    );
    if (
      zeroMeetingImport.sections.created !== 1 ||
      zeroMeetingImport.meetings.created !== 0
    )
      throw new Error('Zero-Meeting fixture did not preserve zero Meetings');

    const failedRelationshipPath = path.join(
      temporaryDirectory,
      'failed-relationship.json',
    );
    const failedRelationship = JSON.parse(
      await readFile(tracer.zeroMeetingFixture, 'utf8'),
    ) as {
      run_id: string;
      active_planning_term: string;
      term_label: string;
      courses: { sections: { section_id: string; course_id: string }[] }[];
    };
    failedRelationship.run_id = 'failed-relationship-import';
    failedRelationship.active_planning_term = 'FAILED-RELATIONSHIP';
    failedRelationship.term_label = 'Failed Relationship Fixture';
    const [failedCourse] = failedRelationship.courses;
    const [failedSection] = failedCourse?.sections ?? [];
    if (!failedSection) throw new Error('Relationship fixture has no Section');
    failedSection.section_id = 'FAILED-RELATIONSHIP:0';
    failedSection.course_id = 'MISSING:0';
    await writeFile(failedRelationshipPath, JSON.stringify(failedRelationship));
    await importSnapshot(failedRelationshipPath, databaseUrl).then(
      () => {
        throw new Error('Invalid relationship import was accepted');
      },
      (error: unknown) => {
        const postgresError = error as { code?: string };
        if (postgresError.code !== '23503') throw error;
      },
    );
    const preservedCounts = await acceptedTermCounts();
    if (
      preservedCounts?.courses !== tracer.expectedCourses ||
      preservedCounts.sections !== tracer.expectedSections ||
      preservedCounts.meetings !== tracer.expectedMeetings
    )
      throw new Error('Failed relationship import changed accepted projection');

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

    const relationships = await queryAnonymous(`
      query RelationshipTracer {
        multiMeeting: courses(where: {
          termCode: {_eq: "${tracer.term}"},
          courseId: {_eq: "AIP:197EX"}
        }) {
          sections(where: {sectionId: {_eq: "S326:265969"}}) {
            sectionId
            meetings(order_by: {meetingIndex: asc}) {
              meetingIndex
              isTba
              days
              startTime
              endTime
              building
              room
              rawDays
              rawTime
              rawLocation
            }
          }
        }
        oneMeeting: courses(where: {
          termCode: {_eq: "${tracer.term}"},
          courseId: {_eq: "AIP:97"}
        }) {
          sections(where: {sectionId: {_eq: "S326:280129"}}) {
            sectionId
            meetings { meetingIndex }
          }
        }
        teamTaught: courses(where: {
          termCode: {_eq: "${tracer.term}"},
          courseId: {_eq: "MGTA:451"}
        }) {
          sections(where: {sectionId: {_eq: "S326:278397"}}) {
            sectionId
            instructorLinks {
              instructor { instructorName }
            }
          }
        }
        zeroMeeting: courses(where: {
          termCode: {_eq: "RELATIONSHIP-EDGE"},
          courseId: {_eq: "TEST:0"}
        }) {
          sections {
            sectionId
            meetings { meetingIndex }
          }
        }
      }
    `);
    if (relationships.errors)
      throw new Error('Anonymous relationship query failed');
    const multiMeeting = relationships.data?.multiMeeting as
      | {
          sections: {
            meetings: {
              isTba: boolean;
              days: string[];
              startTime: string | null;
              endTime: string | null;
              building: string | null;
              room: string | null;
              rawDays: string | null;
              rawTime: string | null;
              rawLocation: string | null;
            }[];
          }[];
        }[]
      | undefined;
    if (multiMeeting?.[0]?.sections[0]?.meetings.length !== 2)
      throw new Error('Multiple Meetings did not round-trip');
    if (
      !multiMeeting[0].sections[0].meetings.every(
        ({
          building,
          days,
          endTime,
          isTba,
          rawDays,
          rawLocation,
          rawTime,
          room,
          startTime,
        }) =>
          isTba &&
          days.length === 0 &&
          startTime === null &&
          endTime === null &&
          building === null &&
          room === null &&
          rawDays === 'TBA' &&
          rawTime === 'TBA' &&
          rawLocation === 'TBA',
      )
    )
      throw new Error('TBA Meeting semantics did not round-trip');
    const oneMeeting = relationships.data?.oneMeeting as
      | { sections: { meetings: unknown[] }[] }[]
      | undefined;
    if (oneMeeting?.[0]?.sections[0]?.meetings.length !== 1)
      throw new Error('One Meeting did not round-trip');
    const teamTaught = relationships.data?.teamTaught as
      | {
          sections: {
            instructorLinks: { instructor: { instructorName: string } }[];
          }[];
        }[]
      | undefined;
    if (teamTaught?.[0]?.sections[0]?.instructorLinks.length !== 3) {
      throw new Error(
        'Team-taught instructor relationships did not round-trip',
      );
    }
    const teamTaughtNames = new Set(
      teamTaught[0].sections[0].instructorLinks.map(
        ({ instructor }) => instructor.instructorName,
      ),
    );
    for (const expectedName of [
      'Wilbur, Kenneth C',
      'Buti, Krisztina',
      'Shahsavand, Shirin',
    ]) {
      if (!teamTaughtNames.has(expectedName))
        throw new Error('Team-taught instructor identity did not round-trip');
    }
    const zeroMeeting = relationships.data?.zeroMeeting as
      | { sections: { meetings: unknown[] }[] }[]
      | undefined;
    if (zeroMeeting?.[0]?.sections[0]?.meetings.length !== 0)
      throw new Error('Zero Meetings did not round-trip');

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
        {
          courses: number;
          runs: number;
          terms: number;
          sections: number;
          meetings: number;
          instructors: number;
          instructorLinks: number;
        }[]
      >`
        select
          (select count(*)::int from courses) as courses,
          (select count(*)::int from import_runs) as runs,
          (select count(*)::int from supported_terms) as terms,
          (select count(*)::int from sections) as sections,
          (select count(*)::int from meetings) as meetings,
          (select count(*)::int from instructors) as instructors,
          (select count(*)::int from section_instructors) as "instructorLinks"
      `;
      if (
        counts?.courses !== tracer.expectedCourses + 1 ||
        counts.runs !== 2 ||
        counts.terms !== 2 ||
        counts.sections !== tracer.expectedSections + 1 ||
        counts.meetings !== tracer.expectedMeetings ||
        counts.instructors !== tracer.expectedInstructors ||
        counts.instructorLinks !== tracer.expectedInstructorLinks
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
      sections: tracer.expectedSections,
      meetings: tracer.expectedMeetings,
      instructors: tracer.expectedInstructors,
      instructorLinks: tracer.expectedInstructorLinks,
      importRuns: 2,
      zeroMeetingRoundTrip: true,
      oneMeetingRoundTrip: true,
      multipleMeetingRoundTrip: true,
      tbaRoundTrip: true,
      teamTaughtRoundTrip: true,
      failedRelationshipPreservedProjection: true,
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
