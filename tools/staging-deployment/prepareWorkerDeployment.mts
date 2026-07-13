import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deploymentArtifactDirectory,
  deploymentContract,
  generatedWranglerPath,
} from './deploymentContext.js';
import { buildWorkerConfig } from './prepareWorkerDeployment.js';

const root = path.resolve(import.meta.dirname, '../..');
const contract = deploymentContract();
const source = await readFile(path.join(root, 'worker/wrangler.jsonc'), 'utf8');
const config = buildWorkerConfig(source, process.env, contract);
const artifactDirectory = deploymentArtifactDirectory(root, contract);
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  generatedWranglerPath(root, contract),
  `${JSON.stringify(config, null, 2)}\n`,
  { mode: 0o600 },
);
await writeFile(
  path.join(artifactDirectory, 'worker-config.json'),
  `${JSON.stringify({
    name: config.name,
    workers_dev: config.workers_dev,
    preview_urls: config.preview_urls,
    routes: config.routes,
    r2_buckets: config.r2_buckets,
    hyperdrive_binding: 'APP_DB_HYPERDRIVE_NO_CACHE',
    public_login_enabled: contract.publicLoginEnabled,
    plan: 'Workers Free',
  })}\n`,
);
console.log(
  JSON.stringify({
    result: 'prepared',
    worker: config.name,
    hostname: contract.hostname,
    publicLoginEnabled: contract.publicLoginEnabled,
    plan: 'Workers Free',
  }),
);
