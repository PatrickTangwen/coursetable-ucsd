import path from 'node:path';

import { deploymentContract } from './deploymentContext.js';
import { acceptedWorkerVersion } from './lastAccepted.js';
import { createR2CatalogStore } from './r2CatalogStore.js';
import { restoreWorkerVersion } from './workerDeployment.js';

const contract = deploymentContract();
if (process.env.CLOUDFLARE_WORKER_NAME !== contract.worker)
  throw new Error(`Unexpected ${contract.target} Worker name`);
if (process.env.LAST_ACCEPTED_KEY !== contract.lastAcceptedKey)
  throw new Error('Unexpected last accepted deployment key');
const body = await createR2CatalogStore(process.env, contract).get(
  contract.lastAcceptedKey,
);
if (!body) throw new Error('Last-accepted deployment evidence is missing');
const acceptedVersion = acceptedWorkerVersion(body, contract);
const root = path.resolve(import.meta.dirname, '../..');
const { changed } = await restoreWorkerVersion({
  acceptedVersion,
  environment: process.env,
  root,
  worker: contract.worker,
  contract,
});
console.log(JSON.stringify({ result: 'restored-accepted-worker', changed }));
