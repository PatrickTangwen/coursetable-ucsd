type EvidenceInput = {
  commit: string;
  worker: { exists: boolean; createdAt?: string; versionId?: string };
  frontend: { fileCount: number; buildDigest: string };
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
  freeBoundary: { [key: string]: unknown };
};

export function composeDeploymentEvidence(
  input: EvidenceInput,
  timestamp: string,
) {
  if (!/^[a-f\d]{40}$/u.test(input.commit))
    throw new Error('Deployment Git commit is invalid');
  if (
    !input.worker.exists ||
    !input.worker.versionId ||
    !input.worker.createdAt
  )
    throw new Error('Worker deployment identity is incomplete');
  if (input.smoke.result !== 'passed' || input.freeBoundary.result !== 'passed')
    throw new Error('Hosted acceptance gates did not pass');
  const active = input.publication.terms.find(
    ({ term }) => term === input.activeTerm,
  );
  if (!active) throw new Error('Active Published Snapshot evidence is missing');

  const evidence = {
    result: 'accepted',
    target: 'staging',
    timestamp,
    gitCommit: input.commit,
    worker: {
      name: 'sungrid-staging',
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
    cloudflarePlan: input.freeBoundary.plan,
    freeBoundary: input.freeBoundary,
    hostedSmoke: input.smoke,
    productionResourcesMutated: false,
    automaticDeploymentEnabled: false,
    automaticProviderUpgradeAuthorized: false,
  };
  assertDeploymentEvidenceSafe(evidence);
  return evidence;
}

export function assertDeploymentEvidenceSafe(value: unknown) {
  visit(value, []);
}

function visit(value: unknown, path: string[]) {
  if (typeof value === 'string') {
    if (
      /(?:postgres(?:ql)?|redis|mysql|mongodb(?:\+srv)?):\/\//iu.test(value) ||
      value.includes('@') ||
      /authorization|bearer|set-cookie|cookie=/iu.test(value) ||
      (/https?:\/\//iu.test(value) &&
        value !== 'https://staging.sungridplanner.com')
    ) {
      throw new Error(
        `Sensitive deployment evidence value at ${path.join('.')}`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, [...path, String(index)]));
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
    visit(item, [...path, key]);
  }
}
