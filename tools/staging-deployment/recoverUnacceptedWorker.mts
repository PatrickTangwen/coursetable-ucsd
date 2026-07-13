import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deploymentArtifactDirectory,
  deploymentContract,
} from './deploymentContext.js';
import { lastAcceptedExistsFilename } from './lastAccepted.js';
import { exists, isObject } from './stagingContract.js';
import {
  assertFirstDeploymentRecoveryAllowed,
  deleteWorkerScript,
  type WorkerDeploymentIdentity,
} from './workerDeployment.js';

if (process.env.RECOVER_UNACCEPTED_FIRST_DEPLOYMENT !== 'true')
  throw new Error('First-deployment recovery was not explicitly authorized');
const contract = deploymentContract();
const worker = required('CLOUDFLARE_WORKER_NAME');
if (worker !== contract.worker)
  throw new Error(`Unexpected ${contract.target} Worker name`);

const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = deploymentArtifactDirectory(root, contract);
const beforePath = path.join(artifactDirectory, 'worker-before.json');
const beforeValue: unknown = JSON.parse(await readFile(beforePath, 'utf8'));
if (!isObject(beforeValue) || typeof beforeValue.exists !== 'boolean')
  throw new Error('Captured Worker identity is invalid');
const before = beforeValue as WorkerDeploymentIdentity;
const expectedVersion = required('RECOVER_UNACCEPTED_WORKER_VERSION');
const acceptedExists = await exists(
  path.join(artifactDirectory, lastAcceptedExistsFilename),
);
assertFirstDeploymentRecoveryAllowed(before, acceptedExists, expectedVersion);

if (before.exists) {
  await deleteWorkerScript(
    {
      accountId: required('CLOUDFLARE_ACCOUNT_ID'),
      apiToken: required('CLOUDFLARE_API_TOKEN'),
      worker,
    },
    expectedVersion,
    fetch,
    contract,
  );
}
await writeFile(beforePath, '{"exists":false}\n');
const evidence = {
  result: before.exists
    ? 'removed-explicitly-authorized-unaccepted-first-deployment'
    : 'explicitly-authorized-unaccepted-first-deployment-already-absent',
  worker: contract.worker,
};
await writeFile(
  path.join(artifactDirectory, 'unaccepted-worker-recovery.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));

function required(name: string) {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing ${contract.target} recovery input: ${name}`);
  return value;
}
