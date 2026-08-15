import { describe, expect, it } from 'vitest';

import {
  findScheduledRefreshPullRequest,
  requireOwnerMergedPullRequest,
  unexpectedScheduledRefreshFiles,
} from './scheduledRefreshQualification.js';

const commit = '3f77b8a949d17078a54bed46ae811a61476433c9';

describe('scheduled refresh qualification', () => {
  it('qualifies a #187-shaped owner merge without relying on summary merged_by', () => {
    const summaries = [
      {
        number: 187,
        merged_at: '2026-08-14T22:56:45Z',
        merged_by: null,
        base: { ref: 'main' },
        head: { ref: 'data-refresh/2026-08-13-0700' },
        merge_commit_sha: commit,
      },
    ];

    const summary = findScheduledRefreshPullRequest(summaries, commit);
    expect(summary?.number).toBe(187);
    expect(() =>
      requireOwnerMergedPullRequest(
        {
          ...summary!,
          merged_by: { login: 'PatrickTangwen' },
        },
        commit,
        'PatrickTangwen',
      ),
    ).not.toThrow();
  });

  it('rejects a non-owner merge through the complete PR details', () => {
    expect(() =>
      requireOwnerMergedPullRequest(
        {
          number: 187,
          merged_at: '2026-08-14T22:56:45Z',
          merged_by: { login: 'someone-else' },
          base: { ref: 'main' },
          head: { ref: 'data-refresh/2026-08-13-0700' },
          merge_commit_sha: commit,
        },
        commit,
        'PatrickTangwen',
      ),
    ).toThrow('repository owner');
  });

  it('accepts only generated catalog artifact paths', () => {
    expect(
      unexpectedScheduledRefreshFiles([
        'api/static/catalogs/public/FA26.json',
        'api/static/catalogs/import-manifests/FA26.json',
        'api/static/metadata.json',
        'frontend/src/generated/supported-terms.json',
      ]),
    ).toEqual([]);
    expect(
      unexpectedScheduledRefreshFiles([
        'api/static/metadata.json',
        '.github/workflows/scheduled-data-refresh-rollout.yml',
      ]),
    ).toEqual(['.github/workflows/scheduled-data-refresh-rollout.yml']);
  });
});
