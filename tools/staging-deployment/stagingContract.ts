import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';

export const stagingContract = {
  bucket: 'sungrid-staging-catalog',
  hostname: 'staging.sungridplanner.com',
  lastAcceptedKey: 'deployment-evidence/last-accepted.json',
  worker: 'sungrid-staging',
  freeLimits: {
    cpuMsPerInvocation: 10,
    cronTriggersPerAccount: 5,
    externalSubrequestsPerInvocation: 50,
    requestsPerDay: 100_000,
    staticAssetsPerVersion: 20_000,
  },
} as const;

export function digest(body: Uint8Array) {
  return createHash('sha256').update(body).digest('hex');
}

export async function exists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

export function isObject(value: unknown): value is { [key: string]: unknown } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isMissingWorker(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = `${(error as { message?: string }).message ?? ''}\n${
    (error as { stderr?: string }).stderr ?? ''
  }`;
  return /has no deployments|does not exist|not found/iu.test(message);
}
