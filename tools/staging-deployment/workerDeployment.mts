import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { deploymentIdentity } from './workerDeployment.js';

const execFileAsync = promisify(execFile);
const [, , commandArgument] = process.argv;
if (commandArgument !== 'capture' && commandArgument !== 'record-current')
  throw new Error('Usage: workerDeployment.mts capture|record-current');
const command = commandArgument;
const workerArgument = process.env.CLOUDFLARE_WORKER_NAME;
if (workerArgument !== 'sungrid-staging')
  throw new Error('Unexpected staging Worker name');
const worker = workerArgument;
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
const filename = path.join(
  artifactDirectory,
  command === 'capture' ? 'worker-before.json' : 'worker-current.json',
);

const identity = await readIdentity();
await writeFile(filename, `${JSON.stringify(identity)}\n`);
console.log(JSON.stringify(identity));

async function readIdentity(): Promise<{
  exists: boolean;
  createdAt?: string;
  versionId?: string;
}> {
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

function isMissingWorker(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = `${(error as { message?: string }).message ?? ''}\n${
    (error as { stderr?: string }).stderr ?? ''
  }`;
  return /has no deployments|does not exist|not found/iu.test(message);
}
