import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseHostedProviderFailureDrill,
  providerFailureDrillSecrets,
} from './providerFailureDrill.js';

const provider = parseHostedProviderFailureDrill(
  process.env.PROVIDER_FAILURE_DRILL,
);
const artifactDirectory = path.resolve(
  import.meta.dirname,
  '../../artifacts/staging-deployment',
);
await mkdir(artifactDirectory, { recursive: true });
const secrets = providerFailureDrillSecrets(provider, process.env);
await writeFile(
  path.join(artifactDirectory, 'worker-secrets.json'),
  `${JSON.stringify(secrets)}\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    result: 'prepared',
    provider,
    runtimeSecretCount: Object.keys(secrets).length,
  }),
);
