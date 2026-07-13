import { describe, expect, it } from 'vitest';

import {
  assertDeploymentEvidenceSafe,
  composeDeploymentEvidence,
} from './deploymentEvidence.js';

describe('staging deployment evidence', () => {
  it('records complete non-sensitive deployment identity', () => {
    const evidence = composeDeploymentEvidence(
      {
        commit: '51df2190fd409fd7f746c0256264c94adce0e01a',
        worker: {
          exists: true,
          createdAt: '2026-07-12T00:00:00.000Z',
          versionId: 'worker-version-id',
        },
        frontend: { fileCount: 100, buildDigest: 'frontend-digest' },
        migration: { schemaVersion: '0002_wild_skaar' },
        publication: {
          metadataDigest: 'metadata-digest',
          storageClass: 'STANDARD',
          terms: [
            {
              term: 'SP26',
              snapshotDigest: 'snapshot-digest',
              manifestDigest: 'manifest-digest',
            },
          ],
        },
        activeTerm: 'SP26',
        smoke: {
          result: 'passed',
          repeats: 3,
          cpuLimitErrorsObserved: false,
          authenticatedIdentityCreated: false,
        },
        freeBoundary: { result: 'passed', plan: 'Workers Free' },
      },
      '2026-07-12T01:02:03.000Z',
    );

    expect(evidence).toMatchObject({
      result: 'accepted',
      target: 'staging',
      timestamp: '2026-07-12T01:02:03.000Z',
      gitCommit: '51df2190fd409fd7f746c0256264c94adce0e01a',
      worker: { versionId: 'worker-version-id' },
      frontend: { fileCount: 100, buildDigest: 'frontend-digest' },
      appDbMigrationVersion: '0002_wild_skaar',
      publishedSnapshot: {
        term: 'SP26',
        digest: 'snapshot-digest',
        manifestDigest: 'manifest-digest',
      },
      cloudflarePlan: 'Workers Free',
    });
    expect(() => assertDeploymentEvidenceSafe(evidence)).not.toThrow();
    expect(evidence).not.toHaveProperty('automaticProviderUpgradeAuthorized');
  });

  it('rejects sensitive fields', () => {
    expect(() =>
      assertDeploymentEvidenceSafe({
        result: 'accepted',
        sessionToken: 'private-value',
      }),
    ).toThrow('Sensitive deployment evidence field');
  });
});
