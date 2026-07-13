import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { buildWorkerConfig } from './prepareWorkerDeployment.js';
import { createProductionContract } from './productionContract.js';
import { buildTermArchive } from './termArchive.js';

const root = path.resolve(import.meta.dirname, '../..');
const environment = {
  DEPLOYMENT_TARGET: 'production',
  CLOUDFLARE_PRODUCTION_HOSTNAME: 'production.sungrid.invalid',
  CLOUDFLARE_WORKER_NAME: 'sungrid-production-validation',
  HYPERDRIVE_CONFIG_ID: '00000000000000000000000000000000',
  R2_CATALOG_BUCKET: 'sungrid-production-validation-catalog',
  VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungrid.invalid',
  PRODUCTION_ISOLATION_VERIFIED_AT: '2026-07-13T20:00:00.000Z',
};
const contract = createProductionContract(environment);
const archive = await buildTermArchive(root);
const workerSource = await readFile(
  path.join(root, 'worker/wrangler.jsonc'),
  'utf8',
);
const worker = buildWorkerConfig(workerSource, environment, contract);
const workflow = parse(
  await readFile(
    path.join(root, '.github/workflows/cloudflare-production-deploy.yml'),
    'utf8',
  ),
) as {
  on?: { workflow_dispatch?: { inputs?: { [key: string]: unknown } } };
  jobs?: { deploy?: { environment?: string } };
};
if (
  !workflow.on?.workflow_dispatch ||
  workflow.jobs?.deploy?.environment !== 'Production'
)
  throw new Error('Production deployment workflow contract is invalid');

const inputNames = Object.keys(workflow.on.workflow_dispatch.inputs ?? {}).join(
  ' ',
);
if (/login|enable/iu.test(inputNames))
  throw new Error('Initial Production deployment must not expose login input');

for (const filename of [
  'catalogR2.mts',
  'deploymentEvidence.mts',
  'prepareWorkerDeployment.mts',
  'restoreLastAccepted.mts',
  'smokeHostedDeployment.mts',
  'verifyStaticAssets.mts',
  'workerDeployment.mts',
  'writeWorkerSecrets.mts',
])
  await access(path.join(import.meta.dirname, filename));

console.log(
  JSON.stringify({
    result: 'passed',
    surface: 'manual Cloudflare Production deployment contract',
    target: contract.target,
    worker: worker.name,
    publicOrigin: `https://${contract.hostname}`,
    publicLoginEnabled: contract.publicLoginEnabled,
    catalogTerms: archive.terms.length,
    catalogMetadataDigestAlgorithm: 'sha256',
    workersDevEnabled: worker.workers_dev,
    previewUrlsEnabled: worker.preview_urls,
    providerResourcesCreated: false,
  }),
);
