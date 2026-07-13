import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildWorkerConfig } from './prepareWorkerDeployment.js';

const root = path.resolve(import.meta.dirname, '../..');
const source = await readFile(path.join(root, 'worker/wrangler.jsonc'), 'utf8');
const config = buildWorkerConfig(source, process.env);
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  path.join(root, 'worker/wrangler.staging.generated.jsonc'),
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
    plan: 'Workers Free',
  })}\n`,
);
console.log(
  JSON.stringify({
    result: 'prepared',
    worker: config.name,
    hostname: process.env.CLOUDFLARE_STAGING_HOSTNAME,
    plan: 'Workers Free',
  }),
);
