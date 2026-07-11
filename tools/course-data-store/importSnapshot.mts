import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import postgres from 'postgres';

import { catalogSnapshotSchema } from '../catalog-snapshot/catalogSnapshot.js';

export type SnapshotImportSummary = {
  term: string;
  courses: { created: number; unchanged: number; rejected: number };
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

      return {
        term: snapshot.active_planning_term,
        courses: {
          created: snapshot.courses.length - existingCourseCount,
          unchanged: existingCourseCount,
          rejected: 0,
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
