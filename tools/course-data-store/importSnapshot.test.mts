import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { importSnapshot } from './importSnapshot.mjs';

const execFileAsync = promisify(execFile);

describe('Course Data Store Snapshot Importer', () => {
  it('rejects an invalid snapshot before attempting a database connection', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'course-import-'));
    const snapshotPath = path.join(directory, 'invalid.json');
    await writeFile(snapshotPath, JSON.stringify({ courses: [] }));

    await expect(
      importSnapshot(snapshotPath, 'postgresql://invalid.invalid/database'),
    ).rejects.toThrow('Published Snapshot is invalid');
  });

  it('returns bounded rejected counts and a non-zero exit for invalid input', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'course-import-'));
    const snapshotPath = path.join(directory, 'invalid.json');
    await writeFile(snapshotPath, '{');

    const result = await execFileAsync(
      'bun',
      ['tools/course-data-store/importSnapshot.mts', snapshotPath],
      {
        cwd: path.resolve(import.meta.dirname, '../..'),
        env: {
          ...process.env,
          COURSE_DATA_STORE_DATABASE_URL:
            'postgresql://invalid.invalid/database',
        },
      },
    ).then(
      () => ({ exitCode: 0, stderr: '' }),
      (error: unknown) => {
        const failure = error as { code: number; stderr: string };
        return { exitCode: failure.code, stderr: failure.stderr };
      },
    );

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr)).toEqual({
      result: 'rejected',
      reason: 'invalid_snapshot',
      courses: { created: 0, unchanged: 0, rejected: 1 },
    });
  });
});
