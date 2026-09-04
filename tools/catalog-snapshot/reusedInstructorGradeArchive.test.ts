import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadReusableInstructorGradeArchive,
  reusedInstructorGradeArchiveLoader,
} from './reusedInstructorGradeArchive';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function makeNormalizedDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'reused-grade-archive-'));
  tempDirs.push(dir);
  return dir;
}

async function writeArchive(
  normalizedDirectory: string,
  run: string,
  subject: string,
  records: unknown[],
): Promise<string> {
  const directory = join(normalizedDirectory, run, 'instructor_grade_archive');
  await mkdir(directory, { recursive: true });
  const artifactPath = join(directory, `${subject}.json`);
  await writeFile(artifactPath, JSON.stringify(records));
  return artifactPath;
}

describe('loadReusableInstructorGradeArchive', () => {
  it('serves each subject from the newest prior run that holds it', async () => {
    const normalizedDirectory = await makeNormalizedDirectory();
    const older = 'multi-2026-08-27T11:00:07.825Z-aaaa-SP26';
    const newer = 'multi-2026-08-31T11:00:06.771Z-bbbb-S224';
    const future = 'multi-2026-09-04T03:04:31.293Z-cccc-S224';
    await writeArchive(normalizedDirectory, older, 'CSE', [{ course: 'old' }]);
    const mathPath = await writeArchive(normalizedDirectory, older, 'MATH', [
      { course: '20A' },
    ]);
    const csePath = await writeArchive(normalizedDirectory, newer, 'CSE', [
      { course: '101' },
    ]);
    await writeArchive(normalizedDirectory, future, 'CSE', [{ course: 'x' }]);
    await mkdir(
      join(normalizedDirectory, 'not-a-run', 'instructor_grade_archive'),
      {
        recursive: true,
      },
    );

    const reusable = await loadReusableInstructorGradeArchive({
      normalizedDirectory,
      before: '2026-09-04T03:04:31.293Z',
    });

    expect(reusable.runs).toEqual([older, newer]);
    expect(reusable.sourceTimestamps).toEqual([
      '2026-08-27T11:00:07.825Z',
      '2026-08-31T11:00:06.771Z',
    ]);
    expect(reusable.bySubject.get('CSE')).toMatchObject({
      run: newer,
      artifactPath: csePath,
      sourceTimestamp: '2026-08-31T11:00:06.771Z',
      records: [{ course: '101' }],
    });
    expect(reusable.bySubject.get('MATH')).toMatchObject({
      run: older,
      artifactPath: mathPath,
      records: [{ course: '20A' }],
    });

    const loader = reusedInstructorGradeArchiveLoader(reusable);
    const context = {} as Parameters<typeof loader>[1];
    expect(loader('cse', context)).toEqual({
      reused: true,
      subject: 'CSE',
      fetched_at: '2026-08-31T11:00:06.771Z',
      source_timestamp: '2026-08-31T11:00:06.771Z',
      normalized_artifact: csePath,
      data: [{ course: '101' }],
    });
    expect(() => loader('BILD', context)).toThrow(
      'No prior Instructor Grade Archive artifact to reuse for BILD',
    );
  });

  it('refuses to run when no prior run holds any archive artifact', async () => {
    const normalizedDirectory = await makeNormalizedDirectory();
    await writeArchive(
      normalizedDirectory,
      'multi-2026-09-04T03:04:31.293Z-cccc-S224',
      'CSE',
      [],
    );

    await expect(
      loadReusableInstructorGradeArchive({
        normalizedDirectory,
        before: '2026-09-04T03:04:31.293Z',
      }),
    ).rejects.toThrow(/No prior Instructor Grade Archive artifacts to reuse/u);
    await expect(
      loadReusableInstructorGradeArchive({
        normalizedDirectory: join(normalizedDirectory, 'missing'),
        before: '2026-09-04T03:04:31.293Z',
      }),
    ).rejects.toThrow(/run a live refresh first/u);
  });
});
