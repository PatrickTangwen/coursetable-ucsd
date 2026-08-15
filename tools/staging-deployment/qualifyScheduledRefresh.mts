import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';

import {
  findScheduledRefreshPullRequest,
  requireOwnerMergedPullRequest,
  unexpectedScheduledRefreshFiles,
  type PullRequestDetails,
  type PullRequestSummary,
} from './scheduledRefreshQualification.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing scheduled refresh input: ${name}`);
  return value;
}

function execute(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with code ${String(code)}: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

const commit = required('DEPLOY_COMMIT');
const repository = required('GITHUB_REPOSITORY');
const repositoryOwner = required('REPOSITORY_OWNER');
const outputPath = required('GITHUB_OUTPUT');
if (!/^[a-f\d]{40}$/u.test(commit))
  throw new Error('DEPLOY_COMMIT must be a full lowercase commit SHA');

const summaries = JSON.parse(
  await execute('gh', [
    'api',
    '-H',
    'Accept: application/vnd.github+json',
    `repos/${repository}/commits/${commit}/pulls`,
  ]),
) as PullRequestSummary[];
const summary = findScheduledRefreshPullRequest(summaries, commit);
if (!summary) {
  await appendFile(outputPath, 'eligible=false\n');
  process.exit(0);
}

const pullRequest = JSON.parse(
  await execute('gh', [
    'api',
    '-H',
    'Accept: application/vnd.github+json',
    `repos/${repository}/pulls/${String(summary.number)}`,
  ]),
) as PullRequestDetails;
requireOwnerMergedPullRequest(pullRequest, commit, repositoryOwner);

await execute('git', ['rev-parse', `${commit}^1`]);
const changedFiles = (
  await execute('git', ['diff', '--name-only', `${commit}^1`, commit, '--'])
)
  .trim()
  .split('\n')
  .filter(Boolean);
const unexpectedFiles = unexpectedScheduledRefreshFiles(changedFiles);
if (unexpectedFiles.length > 0) {
  throw new Error(
    `Scheduled refresh PR contains files outside the generated artifact allowlist:\n${unexpectedFiles.join('\n')}`,
  );
}

await appendFile(outputPath, `commit=${commit}\neligible=true\n`);
