import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assertDeploymentEvidenceSafe } from './deploymentEvidence.js';
import {
  digest,
  exists,
  isObject,
  stagingContract,
} from './stagingContract.js';
import type { TermArchiveStore } from './termArchivePublisher.js';

export const lastAcceptedFilename = 'last-accepted-before.json';
export const lastAcceptedExistsFilename = 'last-accepted-before.exists';

export async function captureLastAccepted(
  store: TermArchiveStore,
  artifactDirectory: string,
) {
  const body = await store.get(stagingContract.lastAcceptedKey);
  const filename = path.join(artifactDirectory, lastAcceptedFilename);
  const marker = path.join(artifactDirectory, lastAcceptedExistsFilename);
  if (!body) {
    await rm(filename, { force: true });
    await rm(marker, { force: true });
    return null;
  }
  parseLastAccepted(body);
  await writeFile(filename, body, { mode: 0o600 });
  await writeFile(marker, 'present\n');
  return body;
}

export async function restoreCapturedLastAccepted(
  store: TermArchiveStore,
  artifactDirectory: string,
) {
  const marker = path.join(artifactDirectory, lastAcceptedExistsFilename);
  if (!(await exists(marker))) {
    await store.delete(stagingContract.lastAcceptedKey);
    if (await store.get(stagingContract.lastAcceptedKey))
      throw new Error('Last-accepted evidence removal verification failed');
    return 'removed-unaccepted-pointer';
  }
  const body = await readFile(
    path.join(artifactDirectory, lastAcceptedFilename),
  );
  await putAndVerify(store, stagingContract.lastAcceptedKey, body);
  return 'restored-last-accepted-pointer';
}

export function acceptedWorkerVersion(body: Uint8Array) {
  const evidence = parseLastAccepted(body);
  const worker = isObject(evidence.worker) ? evidence.worker : null;
  if (!worker || typeof worker.versionId !== 'string')
    throw new Error('Last-accepted Worker version is missing');
  return worker.versionId;
}

export function acceptedGitCommit(body: Uint8Array) {
  const evidence = parseLastAccepted(body);
  if (
    typeof evidence.gitCommit !== 'string' ||
    !/^[a-f\d]{40}$/u.test(evidence.gitCommit)
  )
    throw new Error('Last-accepted Git commit is missing');
  return evidence.gitCommit;
}

export async function putAndVerify(
  store: TermArchiveStore,
  key: string,
  body: Uint8Array,
) {
  const expected = digest(body);
  await store.put(key, body, {
    cacheControl: 'private, no-store',
    contentType: 'application/json; charset=utf-8',
    metadata: { sha256: expected },
    storageClass: 'STANDARD',
  });
  const remote = await store.get(key);
  if (!remote || digest(remote) !== expected)
    throw new Error('Deployment evidence remote digest mismatch');
}

function parseLastAccepted(body: Uint8Array) {
  const evidence: unknown = JSON.parse(new TextDecoder().decode(body));
  assertDeploymentEvidenceSafe(evidence);
  if (!isObject(evidence) || evidence.result !== 'accepted')
    throw new Error('Last-accepted deployment evidence is invalid');
  return evidence;
}
