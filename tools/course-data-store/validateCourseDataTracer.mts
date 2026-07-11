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
  expectedGradeRecords: 318,
  expectedAvailabilityObservations: 275,
  expectedManifestCells: 117,
  snapshotPath: 'api/static/catalogs/public/S326.json',
  manifestPath: 'api/static/catalogs/import-manifests/S326.json',
  zeroMeetingFixture:
    'tools/course-data-store/fixtures/zero-meeting-snapshot.json',
  partialManifestFixture:
    'tools/course-data-store/fixtures/partial-import-manifest.json',
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
    await importSnapshot(
      invalidSnapshot,
      databaseUrl,
      tracer.manifestPath,
    ).then(
      () => {
        throw new Error('Invalid Snapshot was accepted');
      },
      (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes('is invalid'))
          throw error;
      },
    );

    const firstImport = await importSnapshot(
      tracer.snapshotPath,
      databaseUrl,
      tracer.manifestPath,
    );
    const secondImport = await importSnapshot(
      tracer.snapshotPath,
      databaseUrl,
      tracer.manifestPath,
    );
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
      firstImport.gradeRecords.created !== tracer.expectedGradeRecords ||
      firstImport.availabilityObservations.created !==
        tracer.expectedAvailabilityObservations ||
      firstImport.manifestCells.created !== tracer.expectedManifestCells
    )
      throw new Error('Tracer did not create the expected context counts');
    if (
      secondImport.courses.created !== 0 ||
      secondImport.courses.unchanged !== tracer.expectedCourses ||
      secondImport.sections.unchanged !== tracer.expectedSections ||
      secondImport.meetings.unchanged !== tracer.expectedMeetings ||
      secondImport.instructors.unchanged !== tracer.expectedInstructors ||
      secondImport.instructorLinks.unchanged !==
        tracer.expectedInstructorLinks ||
      secondImport.gradeRecords.unchanged !== tracer.expectedGradeRecords ||
      secondImport.availabilityObservations.unchanged !==
        tracer.expectedAvailabilityObservations ||
      secondImport.manifestCells.unchanged !== tracer.expectedManifestCells ||
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
    const conflictingManifestPath = path.join(
      temporaryDirectory,
      'conflicting-manifest.json',
    );
    const conflictingManifest = JSON.parse(
      await readFile(tracer.manifestPath, 'utf8'),
    ) as { run_id: string };
    conflictingManifest.run_id = conflictingSnapshot.run_id;
    await writeFile(
      conflictingManifestPath,
      JSON.stringify(conflictingManifest),
    );
    await importSnapshot(
      conflictingSnapshotPath,
      databaseUrl,
      conflictingManifestPath,
    ).then(
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
      tracer.partialManifestFixture,
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
    const failedManifestPath = path.join(
      temporaryDirectory,
      'failed-relationship-manifest.json',
    );
    const failedManifest = JSON.parse(
      await readFile(tracer.partialManifestFixture, 'utf8'),
    ) as {
      run_id: string;
      active_planning_term: string;
      term_label: string;
      cells: { term: string }[];
    };
    failedManifest.run_id = failedRelationship.run_id;
    failedManifest.active_planning_term =
      failedRelationship.active_planning_term;
    failedManifest.term_label = failedRelationship.term_label;
    for (const cell of failedManifest.cells)
      cell.term = failedRelationship.active_planning_term;
    await writeFile(failedManifestPath, JSON.stringify(failedManifest));
    await importSnapshot(
      failedRelationshipPath,
      databaseUrl,
      failedManifestPath,
    ).then(
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

    const context = await queryAnonymous(`
      query HistoricalAndOperationalContext {
        gradeCourse: courses(where: {
          termCode: {_eq: "${tracer.term}"},
          courseId: {_eq: "ANAR:135"}
        }) {
          gradeArchiveRecords(order_by: {recordIndex: asc}, limit: 1) {
            year
            quarter
            instructor
            gpa
            aPercent
            rawRecord
          }
        }
        availabilitySection: sections(where: {
          termCode: {_eq: "${tracer.term}"},
          sectionId: {_eq: "S326:265969"}
        }) {
          snapshotAvailability {
            enrolled
            capacity
            waitlistCount
            observedAt
            termState
          }
        }
        importRun: courseDataImportRuns(where: {termCode: {_eq: "${tracer.term}"}}) {
          snapshotRunId
          generatedAt
          scheduleSourceTimestamp
          catalogSourceTimestamp
          gradeSourceTimestamp
          manifestOk
          manifestEmpty
          manifestFailed
          manifestPartial
        }
        okCells: importManifestCells(where: {termCode: {_eq: "${tracer.term}"}, status: {_eq: "ok"}}, limit: 1) { status }
        emptyCells: importManifestCells(where: {termCode: {_eq: "${tracer.term}"}, status: {_eq: "empty"}}, limit: 1) { status }
        failedCells: importManifestCells(where: {termCode: {_eq: "${tracer.term}"}, status: {_eq: "failed"}}, limit: 1) { status reason }
        partialCells: importManifestCells(where: {termCode: {_eq: "RELATIONSHIP-EDGE"}, status: {_eq: "partial"}}, limit: 1) { status reason rowCounts }
      }
    `);
    if (context.errors) throw new Error('Anonymous context query failed');
    const gradeCourse = context.data?.gradeCourse as
      | { gradeArchiveRecords: { [key: string]: unknown }[] }[]
      | undefined;
    const grade = gradeCourse?.[0]?.gradeArchiveRecords[0];
    if (
      grade?.year !== '23' ||
      grade.quarter !== 'WI' ||
      grade.instructor !== 'Braswell, Geoffrey E.' ||
      Number(grade.gpa) !== 3.988 ||
      Number(grade.aPercent) !== 100 ||
      typeof grade.rawRecord !== 'object'
    )
      throw new Error('Grade Archive Record did not round-trip');
    const availabilitySections = context.data?.availabilitySection as
      | { snapshotAvailability: { [key: string]: unknown } | null }[]
      | undefined;
    const availability = availabilitySections?.[0]?.snapshotAvailability;
    if (
      availability?.enrolled !== 39 ||
      availability.capacity !== 50 ||
      availability.waitlistCount !== 0 ||
      availability.observedAt !== '2026-06-29T08:02:01.606+00:00' ||
      availability.termState !== 'active'
    )
      throw new Error('Snapshot Availability Data did not round-trip');
    const importRuns = context.data?.importRun as
      | { [key: string]: unknown }[]
      | undefined;
    const [importRun] = importRuns ?? [];
    if (
      importRun?.generatedAt !== '2026-06-29T08:02:01.606+00:00' ||
      importRun.scheduleSourceTimestamp !== '06/28/2026, 02:05:00' ||
      importRun.manifestOk !== 99 ||
      importRun.manifestEmpty !== 11 ||
      importRun.manifestFailed !== 7 ||
      importRun.manifestPartial !== 0
    )
      throw new Error('Import provenance did not round-trip');
    for (const [field, status] of [
      ['okCells', 'ok'],
      ['emptyCells', 'empty'],
      ['failedCells', 'failed'],
      ['partialCells', 'partial'],
    ] as const) {
      const cells = context.data?.[field] as { status: string }[] | undefined;
      if (cells?.[0]?.status !== status)
        throw new Error(`Import Manifest ${status} cell was not queryable`);
    }
    const averageGpa = await queryAnonymous('{ courses { averageGpa } }');
    if (!averageGpa.errors)
      throw new Error('A single course-level Average GPA was exposed');

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
          gradeRecords: number;
          availability: number;
          manifestCells: number;
        }[]
      >`
        select
          (select count(*)::int from courses) as courses,
          (select count(*)::int from import_runs) as runs,
          (select count(*)::int from supported_terms) as terms,
          (select count(*)::int from sections) as sections,
          (select count(*)::int from meetings) as meetings,
          (select count(*)::int from instructors) as instructors,
          (select count(*)::int from section_instructors) as "instructorLinks",
          (select count(*)::int from grade_archive_records) as "gradeRecords",
          (select count(*)::int from snapshot_availability) as availability,
          (select count(*)::int from import_manifest_cells) as "manifestCells"
      `;
      if (
        counts?.courses !== tracer.expectedCourses + 1 ||
        counts.runs !== 2 ||
        counts.terms !== 2 ||
        counts.sections !== tracer.expectedSections + 1 ||
        counts.meetings !== tracer.expectedMeetings ||
        counts.instructors !== tracer.expectedInstructors ||
        counts.instructorLinks !== tracer.expectedInstructorLinks ||
        counts.gradeRecords !== tracer.expectedGradeRecords ||
        counts.availability !== tracer.expectedAvailabilityObservations + 1 ||
        counts.manifestCells !== tracer.expectedManifestCells + 3
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
      gradeRecords: tracer.expectedGradeRecords,
      availabilityObservations: tracer.expectedAvailabilityObservations,
      manifestCells: tracer.expectedManifestCells,
      importRuns: 2,
      zeroMeetingRoundTrip: true,
      oneMeetingRoundTrip: true,
      multipleMeetingRoundTrip: true,
      tbaRoundTrip: true,
      teamTaughtRoundTrip: true,
      failedRelationshipPreservedProjection: true,
      rawGradeRecords: true,
      noAverageGpa: true,
      timestampedSnapshotAvailability: true,
      manifestStatusesQueryable: true,
      importProvenanceQueryable: true,
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
