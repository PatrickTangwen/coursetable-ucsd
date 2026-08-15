import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(process.cwd());

describe('scheduled data refresh rollout assets', () => {
  it('qualifies the full PR details and local merge diff', async () => {
    const source = await readFile(
      path.join(root, 'tools/staging-deployment/qualifyScheduledRefresh.mts'),
      'utf8',
    );

    expect(source).toContain('requireOwnerMergedPullRequest');
    expect(source).toContain("'diff', '--name-only'");
    expect(source).not.toContain('/files');
  });

  it('gates the protected staging-to-Production chain on merged refresh PR and green main CI', async () => {
    const source = await readFile(
      path.join(root, '.github/workflows/scheduled-data-refresh-rollout.yml'),
      'utf8',
    );
    const workflow = parse(source) as {
      on: {
        workflow_run: {
          workflows: string[];
          types: string[];
          branches: string[];
        };
      };
      permissions: { [key: string]: string };
      concurrency: { group: string; 'cancel-in-progress': boolean };
      jobs: {
        qualify: {
          if: string;
          steps: {
            id?: string;
            name?: string;
            uses?: string;
            with?: { [key: string]: unknown };
            run?: string;
          }[];
        };
        staging: {
          if: string;
          needs: string;
          secrets: string;
          uses: string;
          with: { [key: string]: unknown };
        };
        production: {
          needs: string[];
          secrets: string;
          uses: string;
          with: { [key: string]: unknown };
        };
      };
    };

    expect(workflow.on.workflow_run).toEqual({
      workflows: ['CI'],
      types: ['completed'],
      branches: ['main'],
    });
    expect(workflow.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'read',
    });
    expect(workflow.concurrency).toEqual({
      group: 'scheduled-data-refresh-rollout',
      'cancel-in-progress': false,
    });
    expect(workflow.jobs.qualify.if).toContain(
      "github.event.workflow_run.conclusion == 'success'",
    );
    expect(workflow.jobs.qualify.if).toContain(
      "github.event.workflow_run.event == 'push'",
    );
    expect(workflow.jobs.qualify.steps).toMatchObject([
      {
        uses: 'actions/checkout@v4',
        with: { ref: 'main', 'fetch-depth': 0 },
      },
      { uses: 'oven-sh/setup-bun@v2' },
      {
        id: 'pr',
        run: 'bun tools/staging-deployment/qualifyScheduledRefresh.mts',
      },
    ]);
    expect(source).not.toContain('gh api --paginate');

    expect(workflow.jobs.staging).toMatchObject({
      needs: 'qualify',
      uses: './.github/workflows/cloudflare-staging-deploy.yml',
      secrets: 'inherit',
      with: {
        target: 'staging',
        recover_unaccepted_first_deployment: false,
      },
    });
    expect(workflow.jobs.staging.if).toContain(
      "needs.qualify.outputs.eligible == 'true'",
    );
    expect(workflow.jobs.production).toMatchObject({
      needs: ['qualify', 'staging'],
      uses: './.github/workflows/cloudflare-production-deploy.yml',
      secrets: 'inherit',
      with: {
        target: 'production',
        public_login_enabled: true,
        scheduled_refresh_login_authorized: true,
        prove_rollback_after_smoke: false,
        recover_unaccepted_first_deployment: false,
      },
    });
    expect(workflow.jobs.production.with.commit).toBe(
      workflow.jobs.production.with.staging_accepted_commit,
    );
    expect(source).not.toContain('cloudflare-production-login-toggle');
  });
});
