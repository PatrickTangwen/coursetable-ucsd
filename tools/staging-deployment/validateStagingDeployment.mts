import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { buildWorkerConfig } from './prepareWorkerDeployment.js';
import { stagingContract } from './stagingContract.js';
import { buildTermArchive } from './termArchive.js';

const root = path.resolve(import.meta.dirname, '../..');
const archive = await buildTermArchive(root);
const workerSource = await readFile(
  path.join(root, 'worker/wrangler.jsonc'),
  'utf8',
);
const worker = buildWorkerConfig(workerSource, {
  CLOUDFLARE_STAGING_HOSTNAME: stagingContract.hostname,
  CLOUDFLARE_WORKER_NAME: stagingContract.worker,
  HYPERDRIVE_CONFIG_ID: '00000000000000000000000000000000',
  R2_CATALOG_BUCKET: stagingContract.bucket,
  VERIFICATION_EMAIL_FROM_ADDRESS: 'login@mail.sungridplanner.com',
  VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
});
const workflow = parse(
  await readFile(
    path.join(root, '.github/workflows/cloudflare-staging-deploy.yml'),
    'utf8',
  ),
) as { on?: { workflow_dispatch?: unknown }; jobs?: { deploy?: unknown } };
if (!workflow.on?.workflow_dispatch || !workflow.jobs?.deploy)
  throw new Error('Staging deployment workflow contract is invalid');

for (const filename of [
  'catalogR2.mts',
  'deploymentEvidence.mts',
  'prepareWorkerDeployment.mts',
  'restoreLastAccepted.mts',
  'smokeHostedStaging.mts',
  'verifyFreeBoundary.mts',
  'verifyStaticAssets.mts',
  'workerDeployment.mts',
  'writeWorkerSecrets.mts',
])
  await access(path.join(import.meta.dirname, filename));

const evidence = {
  result: 'passed',
  surface: 'manual Cloudflare staging deployment contract',
  target: 'staging',
  worker: worker.name,
  publicOrigin: `https://${stagingContract.hostname}`,
  catalogTerms: archive.terms.length,
  catalogMetadataDigestAlgorithm: 'sha256',
  workersDevEnabled: worker.workers_dev,
  previewUrlsEnabled: worker.preview_urls,
  providerResourcesCreated: false,
};
console.log(JSON.stringify(evidence));
