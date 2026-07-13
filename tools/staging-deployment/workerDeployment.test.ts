import { describe, expect, it } from 'vitest';

import {
  assertActiveMatchesLastAccepted,
  assertFirstDeploymentRecoveryAllowed,
  deleteWorkerScript,
  deploymentIdentity,
} from './workerDeployment.js';

describe('Worker deployment identity', () => {
  it('records the active version without provider actor identity', () => {
    const identity = deploymentIdentity({
      id: 'deployment-id',
      created_on: '2026-07-12T00:00:00.000Z',
      author_email: 'private@example.com',
      versions: [
        { version_id: 'old-version', percentage: 0 },
        { version_id: 'active-version', percentage: 100 },
      ],
    });

    expect(identity).toEqual({
      exists: true,
      createdAt: '2026-07-12T00:00:00.000Z',
      versionId: 'active-version',
    });
    expect(JSON.stringify(identity)).not.toContain('private@example.com');
  });

  it('rejects an active version that differs from durable last accepted', () => {
    expect(() =>
      assertActiveMatchesLastAccepted(
        { exists: true, versionId: 'manual-drift' },
        'accepted-version',
      ),
    ).toThrow('differs from durable last-accepted');
  });

  it('accepts the exact durable last accepted version', () => {
    expect(() =>
      assertActiveMatchesLastAccepted(
        { exists: true, versionId: 'accepted-version' },
        'accepted-version',
      ),
    ).not.toThrow();
  });

  it('removes a first failed Worker through only the Workers Scripts API', async () => {
    const requests: { method: string; pathname: string }[] = [];
    const fetcher = (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push({
        method: request.method,
        pathname: new URL(request.url).pathname,
      });
      if (request.url.endsWith('/deployments')) {
        return Promise.resolve(
          Response.json({
            success: true,
            result: {
              deployments: [
                {
                  created_on: '2026-07-13T01:32:07.000Z',
                  versions: [{ version_id: 'failed-version', percentage: 100 }],
                },
              ],
            },
          }),
        );
      }
      if (request.method === 'DELETE')
        return Promise.resolve(Response.json({ success: true }));
      return Promise.resolve(Response.json({}, { status: 404 }));
    };

    await deleteWorkerScript(
      {
        accountId: 'account-id',
        apiToken: 'redacted-token',
        worker: 'sungrid-staging',
      },
      'failed-version',
      fetcher,
    );

    expect(requests).toEqual([
      {
        method: 'GET',
        pathname:
          '/client/v4/accounts/account-id/workers/scripts/sungrid-staging/deployments',
      },
      {
        method: 'DELETE',
        pathname:
          '/client/v4/accounts/account-id/workers/scripts/sungrid-staging',
      },
      {
        method: 'GET',
        pathname:
          '/client/v4/accounts/account-id/workers/scripts/sungrid-staging',
      },
    ]);
  });

  it('rejects a deployment-list response without an active deployment', async () => {
    const fetcher = () =>
      Promise.resolve(
        Response.json({ success: true, result: { deployments: [] } }),
      );

    await expect(
      deleteWorkerScript(
        {
          accountId: 'account-id',
          apiToken: 'redacted-token',
          worker: 'sungrid-staging',
        },
        'failed-version',
        fetcher,
      ),
    ).rejects.toThrow('Worker deployment readback failed');
  });

  it('allows explicit recovery only when no accepted deployment exists', () => {
    expect(() =>
      assertFirstDeploymentRecoveryAllowed(
        { exists: true, versionId: 'failed-version' },
        false,
        'failed-version',
      ),
    ).not.toThrow();
    expect(() =>
      assertFirstDeploymentRecoveryAllowed(
        { exists: true, versionId: 'accepted-version' },
        true,
        'accepted-version',
      ),
    ).toThrow('cannot remove an accepted Worker');
    expect(() =>
      assertFirstDeploymentRecoveryAllowed(
        { exists: false },
        false,
        'failed-version',
      ),
    ).toThrow('has no Worker to remove');
    expect(() =>
      assertFirstDeploymentRecoveryAllowed(
        { exists: true, versionId: 'replacement-version' },
        false,
        'failed-version',
      ),
    ).toThrow('version changed');
  });
});
