import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { isObject, stagingContract } from './stagingContract.js';

const execFileAsync = promisify(execFile);

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type WorkerDeploymentIdentity = {
  exists: boolean;
  createdAt?: string;
  versionId?: string;
};

export function deploymentIdentity(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.versions))
    throw new Error('Worker deployment status is invalid');
  const { versions: rawVersions } = value;
  const versions: unknown[] = rawVersions;
  const active = versions.find(
    (version) => isObject(version) && version.percentage === 100,
  );
  if (!isObject(active) || typeof active.version_id !== 'string')
    throw new Error('Worker deployment has no 100 percent version');
  if (typeof value.created_on !== 'string')
    throw new Error('Worker deployment timestamp is invalid');
  return {
    exists: true as const,
    createdAt: value.created_on,
    versionId: active.version_id,
  };
}

export function assertActiveMatchesLastAccepted(
  active: WorkerDeploymentIdentity,
  acceptedVersion: string | null,
) {
  if (!acceptedVersion && active.exists)
    throw new Error('Unaccepted staging Worker drift exists before deployment');
  if (
    acceptedVersion &&
    (!active.exists || active.versionId !== acceptedVersion)
  ) {
    throw new Error(
      'Active Worker differs from durable last-accepted deployment',
    );
  }
}

export function assertFirstDeploymentRecoveryAllowed(
  active: WorkerDeploymentIdentity,
  acceptedExists: boolean,
  expectedVersion: string,
) {
  if (acceptedExists) {
    throw new Error(
      'First-deployment recovery cannot remove an accepted Worker',
    );
  }
  if (!active.exists) return;
  if (!active.versionId || active.versionId !== expectedVersion)
    throw new Error('Unaccepted Worker version changed before recovery');
}

export async function restoreWorkerVersion(config: {
  acceptedVersion: string;
  environment: NodeJS.ProcessEnv;
  root: string;
  worker: string;
}) {
  if (!config.acceptedVersion || config.worker !== stagingContract.worker)
    throw new Error('Unexpected Worker restoration identity');
  const wrangler = path.join(config.root, 'node_modules/.bin/wrangler');
  const readActive = async () => {
    const status = await execFileAsync(
      wrangler,
      ['deployments', 'status', '--json', '--name', config.worker],
      {
        cwd: config.root,
        env: config.environment,
        timeout: 30_000,
      },
    );
    return deploymentIdentity(JSON.parse(status.stdout));
  };
  let current = await readActive();
  const changed = current.versionId !== config.acceptedVersion;
  if (changed) {
    await execFileAsync(
      wrangler,
      [
        'rollback',
        config.acceptedVersion,
        '--yes',
        '--name',
        config.worker,
        '--message',
        'restore accepted staging Worker',
      ],
      {
        cwd: config.root,
        env: config.environment,
        timeout: 30_000,
      },
    );
    current = await readActive();
  }
  if (current.versionId !== config.acceptedVersion)
    throw new Error('Accepted Worker restoration verification failed');
  return { changed };
}

export async function deleteWorkerScript(
  config: { accountId: string; apiToken: string; worker: string },
  expectedVersion: string,
  fetcher: Fetcher = fetch,
) {
  if (
    !config.accountId ||
    !config.apiToken ||
    config.worker !== stagingContract.worker ||
    !expectedVersion
  )
    throw new Error('Unexpected Worker deletion identity');
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/workers/scripts/${encodeURIComponent(config.worker)}`;
  const headers = { authorization: `Bearer ${config.apiToken}` };
  const active = await readWorkerDeploymentIdentity(config, fetcher);
  if (!active.exists) return;
  if (active.versionId !== expectedVersion)
    throw new Error('Unaccepted Worker version changed before deletion');
  const deletion = await fetcher(endpoint, { method: 'DELETE', headers });
  if (deletion.status !== 404) {
    const payload: unknown = await deletion.json();
    if (!deletion.ok || !isObject(payload) || payload.success !== true)
      throw new Error('Worker deletion API failed');
  }
  const verification = await fetcher(endpoint, { headers });
  if (verification.status !== 404)
    throw new Error('Worker deletion verification failed');
}

async function readWorkerDeploymentIdentity(
  config: { accountId: string; apiToken: string; worker: string },
  fetcher: Fetcher,
) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/workers/scripts/${encodeURIComponent(config.worker)}/deployments`;
  const response = await fetcher(endpoint, {
    headers: { authorization: `Bearer ${config.apiToken}` },
  });
  if (response.status === 404) return { exists: false as const };
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    !isObject(payload) ||
    payload.success !== true ||
    !isObject(payload.result) ||
    !Array.isArray(payload.result.deployments) ||
    payload.result.deployments.length === 0
  )
    throw new Error('Worker deployment readback failed');
  return deploymentIdentity(payload.result.deployments[0]);
}
