import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { inspectStaticAssets } from './verifyStaticAssets.js';

describe('staging static-asset Free gate', () => {
  it('records a stable build identity and rejects an exceeded file limit', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'sungrid-assets-'));
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'index.html'), '<html></html>');
    await writeFile(path.join(directory, 'assets/app.js'), 'app');

    const first = await inspectStaticAssets(directory, 20_000);
    const repeated = await inspectStaticAssets(directory, 20_000);
    expect(first).toEqual(repeated);
    expect(first.fileCount).toBe(2);
    expect(first.buildDigest).toMatch(/^[a-f\d]{64}$/u);

    await expect(inspectStaticAssets(directory, 1)).rejects.toThrow(
      'Static asset count 2 exceeds Workers Free limit 1',
    );
  });
});
