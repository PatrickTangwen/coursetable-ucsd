import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  acceptedWorkerVersion,
  lastAcceptedExistsFilename,
  lastAcceptedFilename,
} from './lastAccepted.js';
import { exists, isMissingWorker, stagingContract } from './stagingContract.js';
import {
  assertActiveMatchesLastAccepted,
  deploymentIdentity,
  type WorkerDeploymentIdentity,
} from './workerDeployment.js';

const execFileAsync = promisify(execFile);
const [, , commandArgument] = process.argv;
if (
  commandArgument !== 'capture' &&
  commandArgument !== 'verify-accepted' &&
  commandArgument !== 'record-current'
) {
  throw new Error(
    'Usage: workerDeployment.mts capture|verify-accepted|record-current',
  );
}
const command = commandArgument;
const workerArgument = process.env.CLOUDFLARE_WORKER_NAME;
if (workerArgument !== stagingContract.worker)
  throw new Error('Unexpected staging Worker name');
const worker = workerArgument;
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
if (command === 'verify-accepted') {
  const before = JSON.parse(
    await readFile(path.join(artifactDirectory, 'worker-before.json'), 'utf8'),
  ) as WorkerDeploymentIdentity;
  const acceptedExists = await exists(
    path.join(artifactDirectory, lastAcceptedExistsFilename),
  );
  const acceptedVersion = acceptedExists
    ? acceptedWorkerVersion(
        await readFile(path.join(artifactDirectory, lastAcceptedFilename)),
      )
    : null;
  assertActiveMatchesLastAccepted(before, acceptedVersion);
  console.log(JSON.stringify({ result: 'matched-last-accepted' }));
  process.exit(0);
}

const filename = path.join(
  artifactDirectory,
  command === 'capture' ? 'worker-before.json' : 'worker-current.json',
);

const identity = await readIdentity();
await writeFile(filename, `${JSON.stringify(identity)}\n`);
console.log(JSON.stringify(identity));

async function readIdentity(): Promise<WorkerDeploymentIdentity> {
  try {
    const { stdout } = await execFileAsync(
      path.join(root, 'node_modules/.bin/wrangler'),
      ['deployments', 'status', '--json', '--name', worker],
      { cwd: root, env: process.env },
    );
    return deploymentIdentity(JSON.parse(stdout));
  } catch (error) {
    if (command !== 'capture' || !isMissingWorker(error)) throw error;
    return { exists: false };
  }
}
