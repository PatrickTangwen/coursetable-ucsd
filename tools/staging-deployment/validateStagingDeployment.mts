import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { buildCatalogArchive } from './catalogArchive.js';
import { buildWorkerConfig } from './prepareWorkerDeployment.js';

const root = path.resolve(import.meta.dirname, '../..');
const archive = await buildCatalogArchive(root);
const workerSource = await readFile(
  path.join(root, 'worker/wrangler.jsonc'),
  'utf8',
);
const worker = buildWorkerConfig(workerSource, {
  CLOUDFLARE_STAGING_HOSTNAME: 'staging.sungridplanner.com',
  CLOUDFLARE_WORKER_NAME: 'sungrid-staging',
  HYPERDRIVE_CONFIG_ID: '00000000000000000000000000000000',
  R2_CATALOG_BUCKET: 'sungrid-staging-catalog',
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
  publicOrigin: 'https://staging.sungridplanner.com',
  catalogTerms: archive.terms.length,
  catalogMetadataDigestAlgorithm: 'sha256',
  workersDevEnabled: worker.workers_dev,
  previewUrlsEnabled: worker.preview_urls,
  providerResourcesCreated: false,
};
console.log(JSON.stringify(evidence));
