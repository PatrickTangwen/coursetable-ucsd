import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deploymentArtifactDirectory,
  deploymentContract,
} from './deploymentContext.js';
import { workerSecrets } from './writeWorkerSecrets.js';

const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = deploymentArtifactDirectory(
  root,
  deploymentContract(),
);
await mkdir(artifactDirectory, { recursive: true });
const secrets = workerSecrets(process.env);
await writeFile(
  path.join(artifactDirectory, 'worker-secrets.json'),
  `${JSON.stringify(secrets)}\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    result: 'prepared',
    runtimeSecretCount: Object.keys(secrets).length,
  }),
);
