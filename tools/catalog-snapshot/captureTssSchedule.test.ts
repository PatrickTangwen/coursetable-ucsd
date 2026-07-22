import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('attended TSS capture output', () => {
  it('atomically replaces a permissive file with a private sanitized artifact', async () => {
    const { writePrivateArtifact } = await import('./capture-tss-schedule.mjs');
    const directory = await mkdtemp(join(tmpdir(), 'sungrid-tss-capture-'));
    const output = join(directory, 'FA26.json');
    try {
      await writeFile(output, '{"old":true}\n', { mode: 0o644 });
      await chmod(output, 0o644);

      await writePrivateArtifact(output, { schema_version: 'tss-schedule-v1' });

      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({
        schema_version: 'tss-schedule-v1',
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('tightens an existing profile and rejects symlinked profile paths', async () => {
    const { secureProfileDirectory } =
      await import('./capture-tss-schedule.mjs');
    const directory = await mkdtemp(
      join(homedir(), '.sungrid-tss-profile-test-'),
    );
    const profile = join(directory, 'profile');
    const linkedParent = join(directory, 'linked-parent');
    try {
      await mkdir(profile, { mode: 0o755 });
      await chmod(profile, 0o755);
      await secureProfileDirectory(profile);
      expect((await stat(profile)).mode & 0o777).toBe(0o700);

      await symlink(directory, linkedParent);
      await expect(
        secureProfileDirectory(join(linkedParent, 'nested-profile')),
      ).rejects.toThrow(/symbolic links/u);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects unknown OData envelope fields', async () => {
    const { parseODataEnvelope } = await import('./capture-tss-schedule.mjs');

    expect(() =>
      parseODataEnvelope({
        '@odata.count': 0,
        '@odata.deltaLink': 'unexpected',
        value: [],
      }),
    ).toThrow(/unrecognized key/iu);
  });
});
