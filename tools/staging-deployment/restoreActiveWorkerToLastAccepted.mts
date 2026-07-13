import path from 'node:path';

import { acceptedWorkerVersion } from './lastAccepted.js';
import { createR2CatalogStore } from './r2CatalogStore.js';
import { stagingContract } from './stagingContract.js';
import { restoreWorkerVersion } from './workerDeployment.js';

if (process.env.CLOUDFLARE_WORKER_NAME !== stagingContract.worker)
  throw new Error('Unexpected staging Worker name');
if (process.env.LAST_ACCEPTED_KEY !== stagingContract.lastAcceptedKey)
  throw new Error('Unexpected last accepted deployment key');
const body = await createR2CatalogStore().get(stagingContract.lastAcceptedKey);
if (!body) throw new Error('Last-accepted deployment evidence is missing');
const acceptedVersion = acceptedWorkerVersion(body);
const root = path.resolve(import.meta.dirname, '../..');
const { changed } = await restoreWorkerVersion({
  acceptedVersion,
  environment: process.env,
  root,
  worker: stagingContract.worker,
});
console.log(JSON.stringify({ result: 'restored-accepted-worker', changed }));
