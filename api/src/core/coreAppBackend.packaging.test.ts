import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Core App Backend container packaging', () => {
  it('includes shared runtime contracts in the API image', async () => {
    const dockerfile = await readFile(
      path.join(root, 'api/Dockerfile'),
      'utf8',
    );

    expect(dockerfile).toContain('COPY shared/ ./shared/');
  });
});
