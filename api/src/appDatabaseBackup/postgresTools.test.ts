import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createPostgresCustomDump } from './postgresTools.js';
import { useTemporaryDirectory } from './temporaryDirectory.testSupport.js';

const originalImage = process.env.APP_DB_POSTGRES_TOOLS_IMAGE;
const temporaryDirectory = useTemporaryDirectory('pg-tool-test-');
afterEach(() => {
  if (originalImage === undefined)
    delete process.env.APP_DB_POSTGRES_TOOLS_IMAGE;
  else process.env.APP_DB_POSTGRES_TOOLS_IMAGE = originalImage;
});

describe('PostgreSQL backup tool privacy', () => {
  it('does not retain connection or tool stderr in a failing error chain', async () => {
    process.env.APP_DB_POSTGRES_TOOLS_IMAGE = 'invalid-image';
    const directory = await temporaryDirectory();
    const databaseUrl =
      'postgresql://private-student%40ucsd.edu:private-password@db.invalid/app';

    let failure: unknown = undefined;
    try {
      await createPostgresCustomDump(
        databaseUrl,
        path.join(directory, 'backup.dump'),
      );
    } catch (caught) {
      failure = caught;
    }

    expect(failure).toBeInstanceOf(Error);
    const error = failure as Error;
    const output = `${error.stack ?? error.message}\n${String(error.cause)}`;
    expect(output).toContain('PostgreSQL custom dump failed');
    expect(output).not.toContain(databaseUrl);
    expect(output).not.toContain('private-student');
    expect(output).not.toContain('private-password');
    expect(output).not.toContain('db.invalid');
  });
});
