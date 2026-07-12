import { describe, expect, it } from 'vitest';

import { deploymentIdentity } from './workerDeployment.js';

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
});
