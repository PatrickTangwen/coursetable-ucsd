import { describe, expect, it } from 'vitest';

import {
  assertDeploymentEvidenceSafe,
  composeDeploymentEvidence,
  composeLoginToggleEvidence,
} from './deploymentEvidence.js';
import { createProductionContract } from './productionContract.js';

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
        frontend: {
          fileCount: 100,
          buildDigest: 'frontend-digest',
          publicLoginEnabled: true,
        },
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
          publicLoginEnabled: true,
          cpuLimitErrorsObserved: false,
          authenticatedIdentityCreated: false,
        },
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

  it('records Production identity only when the built login state is disabled', () => {
    const contract = createProductionContract({
      DEPLOYMENT_TARGET: 'production',
      CLOUDFLARE_PRODUCTION_HOSTNAME: 'sungridplanner.com',
      CLOUDFLARE_WORKER_NAME: 'sungrid-production',
      R2_CATALOG_BUCKET: 'sungrid-production-catalog',
      VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
      PRODUCTION_ISOLATION_VERIFIED_AT: '2026-07-13T20:00:00.000Z',
    });
    const input = {
      commit: '51df2190fd409fd7f746c0256264c94adce0e01a',
      worker: {
        exists: true,
        createdAt: '2026-07-13T20:10:00.000Z',
        versionId: 'production-worker-version',
      },
      frontend: {
        fileCount: 100,
        buildDigest: 'production-frontend-digest',
        publicLoginEnabled: false,
      },
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
        origin: 'https://sungridplanner.com',
        publicLoginEnabled: false,
      },
    };

    const evidence = composeDeploymentEvidence(
      input,
      '2026-07-13T20:20:00.000Z',
      contract,
    );
    expect(evidence).toMatchObject({
      target: 'production',
      publicLoginEnabled: false,
      productionResourcesMutated: true,
      worker: { name: 'sungrid-production' },
      hostedSmoke: { publicLoginEnabled: false },
    });

    expect(() =>
      composeDeploymentEvidence(
        {
          ...input,
          frontend: { ...input.frontend, publicLoginEnabled: true },
        },
        '2026-07-13T20:20:00.000Z',
        contract,
      ),
    ).toThrow('public login state');
  });

  it('updates durable Production evidence for an approved login toggle', () => {
    const contract = createProductionContract({
      DEPLOYMENT_TARGET: 'production',
      CLOUDFLARE_PRODUCTION_HOSTNAME: 'sungridplanner.com',
      CLOUDFLARE_WORKER_NAME: 'sungrid-production',
      R2_CATALOG_BUCKET: 'sungrid-production-catalog',
      VERIFICATION_EMAIL_SENDER_DOMAIN: 'mail.sungridplanner.com',
      PRODUCTION_ISOLATION_VERIFIED_AT: '2026-07-13T20:00:00.000Z',
      PUBLIC_LOGIN_ENABLED: 'true',
      PRODUCTION_LOGIN_TOGGLE_AUTHORIZED: 'true',
    });
    const prior = {
      result: 'accepted',
      target: 'production',
      timestamp: '2026-07-13T20:20:00.000Z',
      gitCommit: '51df2190fd409fd7f746c0256264c94adce0e01a',
      worker: {
        name: 'sungrid-production',
        versionId: 'prior-version',
        createdAt: '2026-07-13T20:10:00.000Z',
      },
      publishedSnapshot: { term: 'SP26', digest: 'snapshot-digest' },
      productionResourcesMutated: true,
    };
    const evidence = composeLoginToggleEvidence(
      prior,
      {
        worker: {
          exists: true,
          createdAt: '2026-07-13T21:10:00.000Z',
          versionId: 'enabled-version',
        },
        frontend: {
          fileCount: 101,
          buildDigest: 'enabled-frontend-digest',
          publicLoginEnabled: true,
        },
        smoke: {
          result: 'passed',
          origin: 'https://sungridplanner.com',
          publicLoginEnabled: true,
        },
      },
      '2026-07-13T21:20:00.000Z',
      'issue-86-comment-4962456905',
      '2026-07-13T21:15:00Z',
      contract,
    );

    expect(evidence).toMatchObject({
      gitCommit: prior.gitCommit,
      publicLoginEnabled: true,
      worker: { versionId: 'enabled-version' },
      loginToggle: { approvalRecord: 'issue-86-comment-4962456905' },
    });
    expect(() =>
      assertDeploymentEvidenceSafe(evidence, contract),
    ).not.toThrow();
    expect(() =>
      composeLoginToggleEvidence(
        evidence,
        {
          worker: { exists: true, ...evidence.worker },
          frontend: evidence.frontend,
          smoke: evidence.hostedSmoke,
        },
        '2026-07-13T21:30:00.000Z',
        'issue-86-comment-4962456905',
        '2026-07-13T21:15:00Z',
        contract,
      ),
    ).toThrow('fresh approval');
  });
});
