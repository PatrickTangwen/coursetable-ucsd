import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import {
  assertDeploymentEvidenceSafe,
  composeDeploymentEvidence,
} from './deploymentEvidence.js';
import {
  captureLastAccepted,
  putAndVerify,
  restoreCapturedLastAccepted,
} from './lastAccepted.js';
import { createR2CatalogStore } from './r2CatalogStore.js';
import { stagingContract } from './stagingContract.js';

const [, , command] = process.argv;
if (command !== 'capture' && command !== 'accept' && command !== 'report')
  throw new Error('Usage: deploymentEvidence.mts capture|accept|report');
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = path.join(root, 'artifacts/staging-deployment');
await mkdir(artifactDirectory, { recursive: true });
const store = createR2CatalogStore();
const lastAcceptedKey = process.env.LAST_ACCEPTED_KEY;
if (lastAcceptedKey !== stagingContract.lastAcceptedKey)
  throw new Error('Unexpected last accepted deployment key');

if (command === 'capture') {
  const prior = await captureLastAccepted(store, artifactDirectory);
  console.log(JSON.stringify({ result: 'captured', exists: Boolean(prior) }));
} else if (command === 'accept') {
  const config = parse(
    await readFile(
      path.join(root, 'config/catalog-snapshot.ucsd.yaml'),
      'utf8',
    ),
  ) as { active_planning_term?: string };
  if (!config.active_planning_term)
    throw new Error('Active Planning Term is missing');
  const evidence = composeDeploymentEvidence(
    {
      commit: required('DEPLOY_COMMIT'),
      worker: await jsonArtifact('worker-current.json'),
      frontend: await jsonArtifact('frontend-build.json'),
      migration: await jsonArtifact('migration.json'),
      publication: await jsonArtifact('catalog-publication.json'),
      activeTerm: config.active_planning_term,
      smoke: await jsonArtifact('hosted-smoke.json'),
    },
    new Date().toISOString(),
  );
  const body = new TextEncoder().encode(`${JSON.stringify(evidence)}\n`);
  const timestampKey = evidence.timestamp.replaceAll(':', '-');
  const evidenceKey = `deployment-evidence/${timestampKey}-${evidence.gitCommit}.json`;
  await writeFile(
    path.join(artifactDirectory, 'accepted-deployment.json'),
    body,
  );
  await putAndVerify(store, evidenceKey, body);
  await writeFile(
    path.join(artifactDirectory, 'last-accepted-update-attempted'),
    'attempted\n',
  );
  try {
    await putAndVerify(store, lastAcceptedKey, body);
  } catch (error) {
    await restoreCapturedLastAccepted(store, artifactDirectory);
    throw error;
  }
  console.log(JSON.stringify(evidence));
} else {
  const lastAccepted = await store.get(lastAcceptedKey);
  const evidence = lastAccepted
    ? (JSON.parse(new TextDecoder().decode(lastAccepted)) as unknown)
    : null;
  if (evidence) assertDeploymentEvidenceSafe(evidence);
  const status = process.env.DEPLOYMENT_JOB_STATUS ?? 'unknown';
  const report = {
    result: status,
    lastAcceptedDeployment: evidence ?? 'none',
  };
  assertDeploymentEvidenceSafe(report);
  const summary = [
    '# Cloudflare staging deployment',
    '',
    `- Result: ${status}`,
    `- Last accepted deployment: ${
      evidence &&
      typeof evidence === 'object' &&
      Object.hasOwn(evidence, 'gitCommit')
        ? String((evidence as { gitCommit: unknown }).gitCommit)
        : 'none'
    }`,
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(JSON.stringify(report));
}

async function jsonArtifact<T>(filename: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(artifactDirectory, filename), 'utf8'),
  ) as T;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing staging deployment input: ${name}`);
  return value;
}
