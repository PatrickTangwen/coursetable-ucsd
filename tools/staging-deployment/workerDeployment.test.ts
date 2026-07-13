import { describe, expect, it } from 'vitest';

import {
  assertActiveMatchesLastAccepted,
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
});
