import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import postgres from 'postgres';
import { z } from 'zod';

import { catalogSnapshotSchema } from '../catalog-snapshot/catalogSnapshot.js';

export type SnapshotImportSummary = {
  term: string;
  courses: { created: number; unchanged: number; rejected: number };
  sections: { created: number; unchanged: number };
  meetings: { created: number; unchanged: number };
  instructors: { created: number; unchanged: number };
  instructorLinks: { created: number; unchanged: number };
  gradeRecords: { created: number; unchanged: number };
  availabilityObservations: { created: number; unchanged: number };
  manifestCells: { created: number; unchanged: number };
  importRun: 'created' | 'unchanged';
};

const manifestSchema = z
  .object({
    run_id: z.string().min(1),
    generated_at: z.string().min(1),
    active_planning_term: z.string().min(1),
    term_label: z.string().min(1),
    configured_subjects: z.array(z.string()),
    systemic_parser_failure_threshold: z.number(),
    cells: z.array(
      z
        .object({
          term: z.string(),
          subject: z.string(),
          source: z.enum([
            'schedule_of_classes',
            'general_catalog',
            'instructor_grade_archive',
          ]),
          status: z.enum(['ok', 'empty', 'failed', 'partial']),
          reason: z.string().nullable(),
          attempts: z.number().int().nonnegative(),
          row_counts: z.record(z.number()),
          raw_artifacts: z.array(z.string()),
          normalized_artifact: z.string().nullable(),
        })
        .strict(),
    ),
    summary: z
      .object({
        ok: z.number().int().nonnegative(),
        empty: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        partial: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

function parseSnapshotJson(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new Error('Published Snapshot is invalid: malformed JSON');
  }
}

export async function importSnapshot(
  snapshotPath: string,
  databaseUrl: string,
  manifestPath: string,
): Promise<SnapshotImportSummary> {
  const contents = await readFile(snapshotPath, 'utf8');
  const parsed = catalogSnapshotSchema.safeParse(parseSnapshotJson(contents));
  if (!parsed.success) {
    throw new Error(
      `Published Snapshot is invalid: ${parsed.error.issues.length} validation issue(s)`,
    );
  }

  const snapshot = parsed.data;
  const manifestContents = await readFile(manifestPath, 'utf8');
  const manifest = manifestSchema.parse(parseSnapshotJson(manifestContents));
  if (
    manifest.run_id !== snapshot.run_id ||
    manifest.generated_at !== snapshot.generated_at ||
    manifest.active_planning_term !== snapshot.active_planning_term
  )
    throw new Error('Import Manifest does not match Published Snapshot');
  if (
    JSON.stringify(manifest.configured_subjects) !==
    JSON.stringify(snapshot.configured_subjects)
  )
    throw new Error('Import Manifest subjects do not match Published Snapshot');
  const manifestStatusCounts = {
    ok: manifest.cells.filter(({ status }) => status === 'ok').length,
    empty: manifest.cells.filter(({ status }) => status === 'empty').length,
    failed: manifest.cells.filter(({ status }) => status === 'failed').length,
    partial: manifest.cells.filter(({ status }) => status === 'partial').length,
  };
  if (JSON.stringify(manifest.summary) !== JSON.stringify(manifestStatusCounts))
    throw new Error('Import Manifest summary does not match its cells');
  const manifestCellKeys = new Set<string>();
  const expectedManifestCellKeys = new Set(
    manifest.configured_subjects.flatMap((subject) =>
      [
        'schedule_of_classes',
        'general_catalog',
        'instructor_grade_archive',
      ].map((source) => `${subject}:${source}`),
    ),
  );
  for (const cell of manifest.cells) {
    if (cell.term !== manifest.active_planning_term)
      throw new Error('Import Manifest cell belongs to a different term');
    const key = `${cell.subject}:${cell.source}`;
    if (!expectedManifestCellKeys.has(key))
      throw new Error('Import Manifest cell is outside configured coverage');
    if (manifestCellKeys.has(key))
      throw new Error('Import Manifest contains duplicate cells');
    manifestCellKeys.add(key);
  }
  if (manifestCellKeys.size !== expectedManifestCellKeys.size)
    throw new Error('Import Manifest is missing configured cells');
  const sections = snapshot.courses.flatMap((course) => course.sections);
  const meetings = sections.flatMap((section) =>
    section.meetings.map((meeting, meetingIndex) => ({
      ...meeting,
      sectionId: section.section_id,
      meetingIndex,
    })),
  );
  const instructorNames = [
    ...new Set(sections.flatMap((section) => section.instructors)),
  ];
  const instructorLinks = sections.flatMap((section) =>
    section.instructors.map((instructorName) => ({
      sectionId: section.section_id,
      instructorName,
    })),
  );
  const gradeRecords = snapshot.courses.flatMap((course) =>
    course.grade_archive_records.map((record, recordIndex) => ({
      courseId: course.course_id,
      recordIndex,
      record,
    })),
  );
  const availabilityObservations = sections.map((section) => ({
    sectionId: section.section_id,
    enrolled: section.enrolled,
    capacity: section.capacity,
    waitlistCount: section.waitlist_count,
  }));
  const fingerprint = createHash('sha256').update(contents).digest('hex');
  const manifestFingerprint = createHash('sha256')
    .update(manifestContents)
    .digest('hex');
  const generatedDate = new Date(snapshot.generated_at)
    .toISOString()
    .slice(0, 10);
  const termState = !snapshot.term_date_range
    ? 'undated'
    : generatedDate < snapshot.term_date_range.start
      ? 'upcoming'
      : generatedDate > snapshot.term_date_range.end
        ? 'historical'
        : 'active';
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await sql.begin(async (transaction) => {
      const tx = transaction as unknown as typeof sql;
      const [existingRun] = await tx<{ exists: boolean }[]>`
        select exists(
          select 1 from import_runs where artifact_fingerprint = ${fingerprint}
        ) as exists
      `;
      const [existingTerm] = await tx<{ artifactFingerprint: string }[]>`
        select artifact_fingerprint as "artifactFingerprint"
        from supported_terms
        where term_code = ${snapshot.active_planning_term}
      `;
      if (existingTerm && existingTerm.artifactFingerprint !== fingerprint) {
        throw new Error(
          'Supported Term already has a different accepted artifact',
        );
      }
      const [existingCourses] = await tx<{ count: number }[]>`
        select count(*)::int as count from courses
        where term_code = ${snapshot.active_planning_term}
          and course_id in ${tx(snapshot.courses.map((course) => course.course_id))}
      `;
      const existingCourseCount = existingCourses?.count ?? 0;
      const [existingRelationships] = await tx<
        {
          sections: number;
          meetings: number;
          instructorLinks: number;
        }[]
      >`
        select
          (select count(*)::int from sections where term_code = ${snapshot.active_planning_term}) as sections,
          (select count(*)::int from meetings where term_code = ${snapshot.active_planning_term}) as meetings,
          (select count(*)::int from section_instructors where term_code = ${snapshot.active_planning_term}) as "instructorLinks"
      `;
      const [existingInstructors] = instructorNames.length
        ? await tx<{ count: number }[]>`
            select count(*)::int as count from instructors
            where instructor_name in ${tx(instructorNames)}
          `
        : [{ count: 0 }];
      const [existingContext] = await tx<
        { availability: number; gradeRecords: number; manifestCells: number }[]
      >`
        select
          (select count(*)::int from grade_archive_records where term_code = ${snapshot.active_planning_term}) as "gradeRecords",
          (select count(*)::int from snapshot_availability where term_code = ${snapshot.active_planning_term}) as availability,
          (select count(*)::int from import_manifest_cells where artifact_fingerprint = ${fingerprint}) as "manifestCells"
      `;

      await tx`
        insert into import_runs (
          artifact_fingerprint, snapshot_run_id, generated_at, term_code,
          schedule_source_timestamp, catalog_source_timestamp,
          grade_source_timestamp, manifest_fingerprint,
          manifest_ok, manifest_empty, manifest_failed, manifest_partial
        ) values (
          ${fingerprint}, ${snapshot.run_id}, ${snapshot.generated_at},
          ${snapshot.active_planning_term},
          ${snapshot.source_timestamps.schedule_of_classes},
          ${snapshot.source_timestamps.general_catalog},
          ${snapshot.source_timestamps.instructor_grade_archive},
          ${manifestFingerprint}, ${manifestStatusCounts.ok},
          ${manifestStatusCounts.empty}, ${manifestStatusCounts.failed},
          ${manifestStatusCounts.partial}
        ) on conflict (artifact_fingerprint) do nothing
      `;
      await tx`
        insert into supported_terms (
          term_code, term_label, date_start, date_end,
          snapshot_generated_at, artifact_fingerprint
        ) values (
          ${snapshot.active_planning_term}, ${snapshot.term_label},
          ${snapshot.term_date_range?.start ?? null},
          ${snapshot.term_date_range?.end ?? null}, ${snapshot.generated_at},
          ${fingerprint}
        ) on conflict (term_code) do nothing
      `;

      if (snapshot.courses.length > 0) {
        await tx`
          insert into courses ${tx(
            snapshot.courses.map((course) => ({
              term_code: snapshot.active_planning_term,
              course_id: course.course_id,
              subject: course.subject,
              course_number: course.course_number,
              title: course.title,
              units: course.units,
              description: course.description,
              prerequisites_text: course.prerequisites_text,
              restrictions_text: course.restrictions_text,
              catalog_url: course.catalog_url,
            })),
          )}
          on conflict (term_code, course_id) do nothing
        `;
      }
      if (sections.length > 0) {
        await tx`
          insert into sections ${tx(
            sections.map((section) => ({
              term_code: snapshot.active_planning_term,
              section_id: section.section_id,
              course_id: section.course_id,
              section_code: section.section_code,
              meeting_type: section.meeting_type,
            })),
          )}
          on conflict (term_code, section_id) do nothing
        `;
      }
      if (meetings.length > 0) {
        await tx`
          insert into meetings ${tx(
            meetings.map((meeting) => ({
              term_code: snapshot.active_planning_term,
              section_id: meeting.sectionId,
              meeting_index: meeting.meetingIndex,
              days: meeting.days,
              meeting_date: meeting.date,
              start_time: meeting.start_time,
              end_time: meeting.end_time,
              building: meeting.building,
              room: meeting.room,
              is_tba: meeting.is_tba,
              meeting_type: meeting.meeting_type,
              raw_days: meeting.raw_days,
              raw_time: meeting.raw_time,
              raw_location: meeting.raw_location,
            })),
          )}
          on conflict (term_code, section_id, meeting_index) do nothing
        `;
      }
      if (instructorNames.length > 0) {
        await tx`
          insert into instructors ${tx(
            instructorNames.map((instructorName) => ({
              instructor_name: instructorName,
            })),
          )}
          on conflict (instructor_name) do nothing
        `;
      }
      if (instructorLinks.length > 0) {
        await tx`
          insert into section_instructors ${tx(
            instructorLinks.map((link) => ({
              term_code: snapshot.active_planning_term,
              section_id: link.sectionId,
              instructor_name: link.instructorName,
            })),
          )}
          on conflict (term_code, section_id, instructor_name) do nothing
        `;
      }
      if (gradeRecords.length > 0) {
        await tx`
          insert into grade_archive_records ${tx(
            gradeRecords.map(({ courseId, record, recordIndex }) => ({
              term_code: snapshot.active_planning_term,
              course_id: courseId,
              record_index: recordIndex,
              archive_subject: record.subject,
              archive_course: record.course,
              archive_year: record.year,
              archive_quarter: record.quarter,
              archive_title: record.title,
              instructor: record.instructor,
              gpa: record.gpa,
              a_percent: record.a,
              b_percent: record.b,
              c_percent: record.c,
              d_percent: record.d,
              f_percent: record.f,
              w_percent: record.w,
              p_percent: record.p,
              np_percent: record.np,
              raw_record: tx.json(record.raw),
            })),
          )}
          on conflict (term_code, course_id, record_index) do nothing
        `;
      }
      if (availabilityObservations.length > 0) {
        await tx`
          insert into snapshot_availability ${tx(
            availabilityObservations.map((observation) => ({
              term_code: snapshot.active_planning_term,
              section_id: observation.sectionId,
              enrolled: observation.enrolled,
              capacity: observation.capacity,
              waitlist_count: observation.waitlistCount,
              observed_at: snapshot.generated_at,
              term_state: termState,
            })),
          )}
          on conflict (term_code, section_id) do nothing
        `;
      }
      if (manifest.cells.length > 0) {
        await tx`
          insert into import_manifest_cells ${tx(
            manifest.cells.map((cell) => ({
              artifact_fingerprint: fingerprint,
              term_code: cell.term,
              subject: cell.subject,
              source: cell.source,
              status: cell.status,
              reason: cell.reason,
              attempts: cell.attempts,
              row_counts: tx.json(cell.row_counts),
              raw_artifacts: tx.json(cell.raw_artifacts),
              normalized_artifact: cell.normalized_artifact,
            })),
          )}
          on conflict (artifact_fingerprint, subject, source) do nothing
        `;
      }

      return {
        term: snapshot.active_planning_term,
        courses: {
          created: snapshot.courses.length - existingCourseCount,
          unchanged: existingCourseCount,
          rejected: 0,
        },
        sections: {
          created: sections.length - (existingRelationships?.sections ?? 0),
          unchanged: existingRelationships?.sections ?? 0,
        },
        meetings: {
          created: meetings.length - (existingRelationships?.meetings ?? 0),
          unchanged: existingRelationships?.meetings ?? 0,
        },
        instructors: {
          created: instructorNames.length - existingInstructors.count,
          unchanged: existingInstructors.count,
        },
        instructorLinks: {
          created:
            instructorLinks.length -
            (existingRelationships?.instructorLinks ?? 0),
          unchanged: existingRelationships?.instructorLinks ?? 0,
        },
        gradeRecords: {
          created: gradeRecords.length - (existingContext?.gradeRecords ?? 0),
          unchanged: existingContext?.gradeRecords ?? 0,
        },
        availabilityObservations: {
          created:
            availabilityObservations.length -
            (existingContext?.availability ?? 0),
          unchanged: existingContext?.availability ?? 0,
        },
        manifestCells: {
          created:
            manifest.cells.length - (existingContext?.manifestCells ?? 0),
          unchanged: existingContext?.manifestCells ?? 0,
        },
        importRun: existingRun?.exists ? 'unchanged' : 'created',
      };
    });
  } finally {
    await sql.end();
  }
}

async function main() {
  const [, , snapshotPath, manifestPath] = process.argv;
  const databaseUrl = process.env.COURSE_DATA_STORE_DATABASE_URL;
  if (!snapshotPath || !manifestPath)
    throw new Error('usage: importSnapshot.mts <snapshot> <manifest>');
  if (!databaseUrl)
    throw new Error('env config missing: COURSE_DATA_STORE_DATABASE_URL');
  console.log(
    JSON.stringify(
      await importSnapshot(snapshotPath, databaseUrl, manifestPath),
    ),
  );
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const invalidSnapshot =
      error instanceof Error && error.message.startsWith('Published Snapshot');
    console.error(
      JSON.stringify({
        result: 'rejected',
        reason: invalidSnapshot ? 'invalid_snapshot' : 'import_failed',
        courses: { created: 0, unchanged: 0, rejected: 1 },
      }),
    );
    process.exitCode = 1;
  });
}
