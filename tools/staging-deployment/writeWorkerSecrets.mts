import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { workerSecrets } from './writeWorkerSecrets.js';

const artifactDirectory = path.resolve(
  import.meta.dirname,
  '../../artifacts/staging-deployment',
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
