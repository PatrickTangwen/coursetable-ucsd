import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
});
