export type PullRequestSummary = {
  number: number;
  merged_at: string | null;
  base: { ref: string };
  head: { ref: string };
  merge_commit_sha: string | null;
};

export type PullRequestDetails = PullRequestSummary & {
  merged_by: { login: string } | null;
};

export function findScheduledRefreshPullRequest(
  pullRequests: PullRequestSummary[],
  commit: string,
): PullRequestSummary | undefined {
  return pullRequests.find(
    (pullRequest) =>
      pullRequest.merged_at !== null &&
      pullRequest.base.ref === 'main' &&
      pullRequest.head.ref.startsWith('data-refresh/') &&
      pullRequest.merge_commit_sha === commit,
  );
}

export function requireOwnerMergedPullRequest(
  pullRequest: PullRequestDetails,
  commit: string,
  repositoryOwner: string,
): void {
  if (
    pullRequest.merged_at === null ||
    pullRequest.base.ref !== 'main' ||
    !pullRequest.head.ref.startsWith('data-refresh/') ||
    pullRequest.merge_commit_sha !== commit
  )
    throw new Error('Complete PR details do not match the refresh merge');

  if (pullRequest.merged_by?.login !== repositoryOwner) {
    throw new Error(
      'Scheduled refresh PR was not merged by the repository owner',
    );
  }
}

export function unexpectedScheduledRefreshFiles(files: string[]): string[] {
  return files.filter(
    (file) =>
      !file.startsWith('api/static/catalogs/') &&
      file !== 'api/static/metadata.json' &&
      file !== 'frontend/src/generated/supported-terms.json',
  );
}
