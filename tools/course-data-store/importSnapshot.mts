import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import postgres from 'postgres';

import { catalogSnapshotSchema } from '../catalog-snapshot/catalogSnapshot.js';

export type SnapshotImportSummary = {
  term: string;
  courses: { created: number; unchanged: number; rejected: number };
  sections: { created: number; unchanged: number };
  meetings: { created: number; unchanged: number };
  instructors: { created: number; unchanged: number };
  instructorLinks: { created: number; unchanged: number };
  importRun: 'created' | 'unchanged';
};

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
): Promise<SnapshotImportSummary> {
  const contents = await readFile(snapshotPath, 'utf8');
  const parsed = catalogSnapshotSchema.safeParse(parseSnapshotJson(contents));
  if (!parsed.success) {
    throw new Error(
      `Published Snapshot is invalid: ${parsed.error.issues.length} validation issue(s)`,
    );
  }

  const snapshot = parsed.data;
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
  const fingerprint = createHash('sha256').update(contents).digest('hex');
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

      await tx`
        insert into import_runs (
          artifact_fingerprint, snapshot_run_id, generated_at, term_code
        ) values (
          ${fingerprint}, ${snapshot.run_id}, ${snapshot.generated_at},
          ${snapshot.active_planning_term}
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
        importRun: existingRun?.exists ? 'unchanged' : 'created',
      };
    });
  } finally {
    await sql.end();
  }
}

async function main() {
  const [, , snapshotPath] = process.argv;
  const databaseUrl = process.env.COURSE_DATA_STORE_DATABASE_URL;
  if (!snapshotPath) throw new Error('usage: importSnapshot.mts <snapshot>');
  if (!databaseUrl)
    throw new Error('env config missing: COURSE_DATA_STORE_DATABASE_URL');
  console.log(JSON.stringify(await importSnapshot(snapshotPath, databaseUrl)));
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
