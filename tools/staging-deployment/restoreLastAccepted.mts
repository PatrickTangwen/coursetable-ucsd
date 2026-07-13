import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  acceptedWorkerVersion,
  lastAcceptedExistsFilename,
  lastAcceptedFilename,
  restoreCapturedLastAccepted,
} from './lastAccepted.js';
import { createR2CatalogStore } from './r2CatalogStore.js';
import { exists, isObject, stagingContract } from './stagingContract.js';
import {
  deleteWorkerScript,
  restoreWorkerVersion,
} from './workerDeployment.js';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
const worker = process.env.CLOUDFLARE_WORKER_NAME;
if (worker !== stagingContract.worker)
  throw new Error('Unexpected staging Worker name');

let workerResult = 'not-required';
if (await exists(path.join(artifactDirectory, 'worker-deploy-attempted'))) {
  const acceptedExists = await exists(
    path.join(artifactDirectory, lastAcceptedExistsFilename),
  );
  if (acceptedExists) {
    const acceptedVersion = acceptedWorkerVersion(
      await readFile(path.join(artifactDirectory, lastAcceptedFilename)),
    );
    const restored = await restoreWorkerVersion({
      acceptedVersion,
      environment: process.env,
      root,
      worker,
    });
    workerResult = restored.changed ? 'rolled-back' : 'already-accepted';
  } else {
    const currentValue: unknown = JSON.parse(
      await readFile(
        path.join(artifactDirectory, 'worker-current.json'),
        'utf8',
      ),
    );
    if (!isObject(currentValue) || typeof currentValue.exists !== 'boolean')
      throw new Error('Failed deployment Worker version is missing');
    if (currentValue.exists) {
      if (typeof currentValue.versionId !== 'string')
        throw new Error('Failed deployment Worker version is missing');
      await deleteWorkerScript(
        {
          accountId: required('CLOUDFLARE_ACCOUNT_ID'),
          apiToken: required('CLOUDFLARE_API_TOKEN'),
          worker,
        },
        currentValue.versionId,
      );
      workerResult = 'removed-first-failed-deployment';
    } else {
      workerResult = 'no-first-deployment-created';
    }
  }
}

await execFileAsync(
  'bun',
  [path.join(import.meta.dirname, 'catalogR2.mts'), 'restore'],
  { cwd: root, env: process.env },
);

let evidenceResult = 'not-required';
if (
  await exists(path.join(artifactDirectory, 'last-accepted-update-attempted'))
) {
  evidenceResult = await restoreCapturedLastAccepted(
    createR2CatalogStore(),
    artifactDirectory,
  );
}

const evidence = {
  result: 'restored-last-accepted',
  catalogMetadata: 'restored',
  worker: workerResult,
  deploymentEvidence: evidenceResult,
};
await writeFile(
  path.join(artifactDirectory, 'restoration.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing staging recovery input: ${name}`);
  return value;
}
