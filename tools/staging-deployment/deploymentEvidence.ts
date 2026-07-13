import type { HostedDeploymentContract } from './productionContract.js';
import { isObject, stagingContract } from './stagingContract.js';

type EvidenceInput = {
  commit: string;
  worker: { exists: boolean; createdAt?: string; versionId?: string };
  frontend: {
    fileCount: number;
    buildDigest: string;
    publicLoginEnabled: boolean;
  };
  migration: { schemaVersion: string };
  publication: {
    metadataDigest: string;
    storageClass: string;
    terms: {
      term: string;
      snapshotDigest: string;
      manifestDigest: string;
    }[];
  };
  activeTerm: string;
  smoke: { [key: string]: unknown };
};

export function composeDeploymentEvidence(
  input: EvidenceInput,
  timestamp: string,
  contract: HostedDeploymentContract = stagingContract,
) {
  if (!/^[a-f\d]{40}$/u.test(input.commit))
    throw new Error('Deployment Git commit is invalid');
  if (
    !input.worker.exists ||
    !input.worker.versionId ||
    !input.worker.createdAt
  )
    throw new Error('Worker deployment identity is incomplete');
  if (input.smoke.result !== 'passed')
    throw new Error('Hosted acceptance gate did not pass');
  if (
    input.frontend.publicLoginEnabled !== contract.publicLoginEnabled ||
    input.smoke.publicLoginEnabled !== contract.publicLoginEnabled
  )
    throw new Error('Deployment public login state does not match contract');

  const active = input.publication.terms.find(
    ({ term }) => term === input.activeTerm,
  );
  if (!active) throw new Error('Active Published Snapshot evidence is missing');

  const evidence = {
    result: 'accepted',
    target: contract.target,
    timestamp,
    gitCommit: input.commit,
    worker: {
      name: contract.worker,
      versionId: input.worker.versionId,
      createdAt: input.worker.createdAt,
    },
    frontend: input.frontend,
    appDbMigrationVersion: input.migration.schemaVersion,
    publishedSnapshot: {
      term: active.term,
      digest: active.snapshotDigest,
      manifestDigest: active.manifestDigest,
      archiveMetadataDigest: input.publication.metadataDigest,
      archiveTermCount: input.publication.terms.length,
      r2StorageClass: input.publication.storageClass,
    },
    hostedSmoke: input.smoke,
    publicLoginEnabled: contract.publicLoginEnabled,
    productionResourcesMutated: contract.target === 'production',
    automaticDeploymentEnabled: false,
  };
  assertDeploymentEvidenceSafe(evidence, contract);
  return evidence;
}

export function composeLoginToggleEvidence(
  prior: unknown,
  input: Pick<EvidenceInput, 'worker' | 'frontend' | 'smoke'>,
  timestamp: string,
  approvalRecord: string,
  approvalCreatedAt: string,
  contract: HostedDeploymentContract,
) {
  assertDeploymentEvidenceSafe(prior, contract);
  if (
    contract.target !== 'production' ||
    !isObject(prior) ||
    prior.result !== 'accepted' ||
    prior.target !== 'production' ||
    typeof prior.gitCommit !== 'string' ||
    !/^[a-f\d]{40}$/u.test(prior.gitCommit)
  )
    throw new Error('Production login toggle requires accepted evidence');
  if (!/^issue-86-comment-\d+$/u.test(approvalRecord))
    throw new Error('Production login approval record is invalid');
  if (
    typeof prior.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(prior.timestamp)) ||
    !Number.isFinite(Date.parse(approvalCreatedAt)) ||
    Date.parse(approvalCreatedAt) <= Date.parse(prior.timestamp) ||
    (isObject(prior.loginToggle) &&
      prior.loginToggle.approvalRecord === approvalRecord)
  )
    throw new Error('Production login toggle requires a fresh approval');
  if (
    !input.worker.exists ||
    !input.worker.versionId ||
    !input.worker.createdAt
  )
    throw new Error('Worker deployment identity is incomplete');
  if (
    input.frontend.publicLoginEnabled !== contract.publicLoginEnabled ||
    input.smoke.result !== 'passed' ||
    input.smoke.publicLoginEnabled !== contract.publicLoginEnabled
  )
    throw new Error('Production login toggle state did not pass smoke');

  const evidence = {
    ...prior,
    timestamp,
    worker: {
      name: contract.worker,
      versionId: input.worker.versionId,
      createdAt: input.worker.createdAt,
    },
    frontend: input.frontend,
    hostedSmoke: input.smoke,
    publicLoginEnabled: contract.publicLoginEnabled,
    productionResourcesMutated: true,
    loginToggle: { approvalRecord, approvalCreatedAt },
  };
  assertDeploymentEvidenceSafe(evidence, contract);
  return evidence;
}

export function assertDeploymentEvidenceSafe(
  value: unknown,
  contract: HostedDeploymentContract = stagingContract,
) {
  visit(value, [], contract);
}

function visit(
  value: unknown,
  path: string[],
  contract: HostedDeploymentContract,
) {
  if (typeof value === 'string') {
    if (
      /(?:postgres(?:ql)?|redis|mysql|mongodb(?:\+srv)?):\/\//iu.test(value) ||
      value.includes('@') ||
      /authorization|bearer|set-cookie|cookie=/iu.test(value) ||
      (/https?:\/\//iu.test(value) && value !== `https://${contract.hostname}`)
    ) {
      throw new Error(
        `Sensitive deployment evidence value at ${path.join('.')}`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      visit(item, [...path, String(index)], contract),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/(?<=[a-z])(?=[A-Z])/gu, '_').toLowerCase();
    if (
      /(?:^|_)(?:api_key|authorization|code|code_hash|connection_string|cookie|credential|database_url|db_url|email|password|request_body|secret|session|session_id|token)$/u.test(
        normalized,
      )
    ) {
      throw new Error(
        `Sensitive deployment evidence field at ${[...path, key].join('.')}`,
      );
    }
    visit(item, [...path, key], contract);
  }
}
