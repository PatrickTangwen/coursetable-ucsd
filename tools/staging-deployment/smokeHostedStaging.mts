import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runHostedStagingSmoke } from './smokeHostedStaging.js';

const hostname = process.env.CLOUDFLARE_STAGING_HOSTNAME;
if (!hostname) throw new Error('Missing CLOUDFLARE_STAGING_HOSTNAME');
const evidence = await runHostedStagingSmoke(`https://${hostname}`);
const artifactDirectory = path.resolve(
  import.meta.dirname,
  '../../artifacts/staging-deployment',
);
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  path.join(artifactDirectory, 'hosted-smoke.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));
