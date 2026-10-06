import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = path.resolve(
  'tools/staging-deployment/qualifyScheduledRefresh.mts',
);
let directory = '';
let commit = '';

function git(...args: string[]) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
}

function runQualification({
  match = true,
  owner = 'PatrickTangwen',
  apiFailure = false,
} = {}) {
  const pullRequest = {
    number: 208,
    merged_at: '2026-10-05T20:11:19Z',
    base: { ref: 'main' },
    head: { ref: 'data-refresh/2026-10-05-0700' },
    merge_commit_sha: commit,
    merged_by: { login: owner },
  };
  writeFileSync(
    path.join(directory, 'fixture.json'),
    JSON.stringify({
      pages: [
        [{ ...pullRequest, merge_commit_sha: 'a'.repeat(40) }],
        match ? [pullRequest] : [],
      ],
      pullRequest,
      apiFailure,
    }),
  );
  const result = spawnSync('bun', [script], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH ?? ''}`,
      DEPLOY_COMMIT: commit,
      GITHUB_REPOSITORY: 'PatrickTangwen/coursetable-ucsd',
      REPOSITORY_OWNER: 'PatrickTangwen',
      GITHUB_OUTPUT: path.join(directory, 'output'),
    },
  });
  return {
    ...result,
    output: readFileSync(path.join(directory, 'output'), 'utf8'),
  };
}

beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'refresh-qualification-'));
  git('init', '--quiet');
  git('config', 'user.name', 'Qualification Test');
  git('config', 'user.email', 'qualification@example.com');
  git(
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--allow-empty',
    '-m',
    'baseline',
  );
  mkdirSync(path.join(directory, 'api/static'), { recursive: true });
  writeFileSync(path.join(directory, 'api/static/metadata.json'), '{}');
  git('add', 'api/static/metadata.json');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'refresh');
  commit = git('rev-parse', 'HEAD');
  writeFileSync(path.join(directory, 'output'), '');
  writeFileSync(
    path.join(directory, 'gh'),
    `#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync('fixture.json', 'utf8'));
const args = process.argv.slice(2);
if (fixture.apiFailure) {
  console.error('GitHub API unavailable');
  process.exit(1);
}
const endpoint = args.find((arg) => arg.startsWith('repos/'));
if (endpoint.includes('/commits/')) {
  console.log('[]');
} else if (endpoint.includes('/pulls?')) {
  const query = new URL('https://api.github.com/' + endpoint).searchParams;
  if (query.get('state') !== 'closed' || query.get('base') !== 'main') process.exit(2);
  if (!args.includes('--paginate') || !args.includes('--slurp')) process.exit(3);
  console.log(JSON.stringify(fixture.pages));
} else if (endpoint.endsWith('/pulls/208')) {
  console.log(JSON.stringify(fixture.pullRequest));
} else {
  process.exit(4);
}
`,
    { mode: 0o755 },
  );
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('scheduled refresh qualification command', () => {
  it('qualifies an exact merge on a later PR page even when commit associations are empty', () => {
    const result = runQualification();
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe(`commit=${commit}\neligible=true\n`);
  });

  it('reports a skipped deployment for a commit without a matching refresh PR', () => {
    const result = runQualification({ match: false });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('eligible=false\n');
    expect(result.stdout).toContain('Skipping scheduled refresh deployment');
  });

  it('fails closed when the PR list cannot be read', () => {
    const result = runQualification({ apiFailure: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('GitHub API unavailable');
    expect(result.output).toBe('');
  });

  it('still rejects a merge by someone other than the repository owner', () => {
    const result = runQualification({ owner: 'someone-else' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('repository owner');
    expect(result.output).toBe('');
  });

  it('still rejects changes outside generated catalog artifacts', () => {
    writeFileSync(path.join(directory, 'unsafe.txt'), 'not a catalog artifact');
    git('add', 'unsafe.txt');
    git('-c', 'commit.gpgsign=false', 'commit', '-m', 'unexpected change');
    commit = git('rev-parse', 'HEAD');
    const result = runQualification();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('outside the generated artifact allowlist');
    expect(result.output).toBe('');
  });
});
