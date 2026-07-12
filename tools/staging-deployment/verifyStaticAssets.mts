import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { inspectStaticAssets } from './verifyStaticAssets.js';

const root = path.resolve(import.meta.dirname, '../..');
const evidence = {
  result: 'passed',
  limit: 20_000,
  ...(await inspectStaticAssets(path.join(root, 'frontend/build'), 20_000)),
};
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  path.join(artifactDirectory, 'frontend-build.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));
