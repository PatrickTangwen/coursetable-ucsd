import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLocalHttpsCredentials } from '../../shared/localHttps.js';

describe('local HTTPS credentials', () => {
  it('reads the untracked localhost certificate pair', async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sungrid-https-'),
    );

    try {
      await fs.writeFile(
        path.join(directory, 'localhost-key.pem'),
        'local-key',
      );
      await fs.writeFile(
        path.join(directory, 'localhost-cert.pem'),
        'local-certificate',
      );

      const credentials = readLocalHttpsCredentials(directory);

      expect(credentials.key.toString()).toBe('local-key');
      expect(credentials.cert.toString()).toBe('local-certificate');
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('points maintainers to the local setup command when files are missing', () => {
    const directory = path.join(os.tmpdir(), 'sungrid-missing-https');

    expect(() => readLocalHttpsCredentials(directory)).toThrow(
      'bun run local:https:setup',
    );
  });
});
