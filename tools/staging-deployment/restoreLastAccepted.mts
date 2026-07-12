import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { deploymentIdentity } from './workerDeployment.js';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
const wrangler = path.join(root, 'node_modules/.bin/wrangler');
const worker = process.env.CLOUDFLARE_WORKER_NAME;
if (worker !== 'sungrid-staging')
  throw new Error('Unexpected staging Worker name');

await execFileAsync(
  'bun',
  [path.join(import.meta.dirname, 'catalogR2.mts'), 'restore'],
  { cwd: root, env: process.env },
);

let workerResult = 'not-required';
if (await exists(path.join(artifactDirectory, 'worker-deploy-attempted'))) {
  const before = JSON.parse(
    await readFile(path.join(artifactDirectory, 'worker-before.json'), 'utf8'),
  ) as { exists?: boolean; versionId?: string };
  if (before.exists) {
    if (!before.versionId) throw new Error('Last Worker version is missing');
    await execFileAsync(
      wrangler,
      [
        'rollback',
        before.versionId,
        '--yes',
        '--name',
        worker,
        '--message',
        'restore last accepted staging deployment',
      ],
      { cwd: root, env: process.env },
    );
    const { stdout } = await execFileAsync(
      wrangler,
      ['deployments', 'status', '--json', '--name', worker],
      { cwd: root, env: process.env },
    );
    const restored = deploymentIdentity(JSON.parse(stdout));
    if (restored.versionId !== before.versionId)
      throw new Error('Worker rollback verification failed');
    workerResult = 'rolled-back';
  } else {
    await execFileAsync(wrangler, ['delete', worker, '--force'], {
      cwd: root,
      env: process.env,
    });
    workerResult = 'removed-first-failed-deployment';
  }
}

const evidence = {
  result: 'restored-last-accepted',
  catalogMetadata: 'restored',
  worker: workerResult,
};
await writeFile(
  path.join(artifactDirectory, 'restoration.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));

async function exists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}
