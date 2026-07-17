import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(process.cwd());

describe('Cloudflare Production deployment assets', () => {
  it('declares a manual protected first deployment with public login forced off', async () => {
    const source = await readFile(
      path.join(root, '.github/workflows/cloudflare-production-deploy.yml'),
      'utf8',
    );
    const workflow = parse(source) as {
      on: { workflow_dispatch: { inputs: { [key: string]: unknown } } };
      permissions: { [key: string]: string };
      concurrency: { group: string; 'cancel-in-progress': boolean };
      jobs: {
        [key: string]: {
          env?: { [key: string]: string };
          environment?: string;
          if?: string;
          steps: {
            env?: { [key: string]: string };
            if?: string;
            name?: string;
            run?: string;
          }[];
        };
      };
    };

    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs).toMatchObject({
      target: { required: true, type: 'choice', options: ['production'] },
      commit: { required: true, type: 'string' },
      prove_rollback_after_smoke: {
        required: true,
        type: 'boolean',
        default: false,
      },
    });
    expect(JSON.stringify(workflow.on.workflow_dispatch.inputs)).not.toMatch(
      /login|enable/iu,
    );
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'sungrid-production-deployment',
      'cancel-in-progress': false,
    });

    const preflight = workflow.jobs.preflight!;
    const deploy = workflow.jobs.deploy!;
    expect(preflight.environment).toBeUndefined();
    expect(deploy.environment).toBe('Production');
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(deploy.env).toMatchObject({
      DEPLOYMENT_TARGET: 'production',
      PUBLIC_LOGIN_ENABLED: 'false',
      STAGING_ACCEPTED_COMMIT: `${'$'}{{ vars.STAGING_ACCEPTED_COMMIT }}`,
    });
    expect(source).toContain(
      'git merge-base --is-ancestor "$SELECTED_COMMIT" origin/main',
    );
    expect(source).toContain(
      'test "$DEPLOY_COMMIT" = "$STAGING_ACCEPTED_COMMIT"',
    );
    expect(source).toContain('PRODUCTION_ISOLATION_VERIFIED_AT');
    expect(source).toContain('worker/wrangler.production.generated.jsonc');
    expect(
      source.indexOf('Deliberately exercise application rollback'),
    ).toBeLessThan(source.indexOf('Record accepted deployment'));
    expect(source).not.toContain("VITE_PUBLIC_LOGIN_ENABLED: 'true'");
    expect(source).not.toContain('doppler');

    const restore = deploy.steps.find(
      (step) => step.name === 'Restore last accepted deployment on failure',
    );
    expect(restore?.if).toContain('failure() || cancelled()');

    const packageJson = JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8'),
    ) as { scripts: { [key: string]: string } };
    expect(packageJson.scripts['validate:production-deployment']).toBe(
      'bun tools/staging-deployment/validateProductionDeployment.mts',
    );
  });

  it('declares a separate protected login enable and disable path', async () => {
    const source = await readFile(
      path.join(
        root,
        '.github/workflows/cloudflare-production-login-toggle.yml',
      ),
      'utf8',
    );
    const workflow = parse(source) as {
      on: {
        workflow_dispatch: {
          inputs: { [key: string]: { [key: string]: unknown } };
        };
      };
      concurrency: { group: string; 'cancel-in-progress': boolean };
      jobs: {
        toggle: {
          environment: string;
          env: { [key: string]: string };
          steps: { if?: string; name?: string; run?: string }[];
        };
      };
    };

    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs).toMatchObject({
      desired_state: {
        required: true,
        type: 'choice',
        options: ['disabled', 'enabled'],
        default: 'disabled',
      },
      approval_record: { required: true, type: 'string' },
    });
    expect(workflow.concurrency).toEqual({
      group: 'sungrid-production-deployment',
      'cancel-in-progress': false,
    });
    const { toggle } = workflow.jobs;
    expect(toggle.environment).toBe('Production');
    expect(toggle.env).toMatchObject({
      DEPLOYMENT_TARGET: 'production',
      PRODUCTION_LOGIN_TOGGLE_AUTHORIZED: 'true',
    });
    expect(source).toContain('PRODUCTION_LOGIN_APPROVAL_RECORD');
    expect(source).toContain('author_association');
    expect(source).toContain('.issue_url');
    expect(source).toContain('.created_at');
    expect(source).toContain('last-accepted-before.json');
    expect(source).toContain('APPROVE PRODUCTION LOGIN');
    expect(source).toContain('deploymentEvidence.mts capture');
    expect(source).toContain('workerDeployment.mts verify-accepted');
    expect(source).toContain('smokeHostedDeployment.mts');
    expect(source).toContain('restoreLastAccepted.mts');
    expect(source).not.toContain('db:migrate');
    expect(source).not.toContain('catalogR2.mts publish');
    const restore = toggle.steps.find(
      (step) => step.name === 'Restore last accepted deployment on failure',
    );
    expect(restore?.if).toContain('failure() || cancelled()');
  });

  it('declares an isolated default-off Production backup and restore proof', async () => {
    const source = await readFile(
      path.join(root, '.github/workflows/app-db-backup-production.yml'),
      'utf8',
    );
    const workflow = parse(source) as {
      on: { workflow_dispatch: unknown; schedule: unknown[] };
      concurrency: { group: string; 'cancel-in-progress': boolean };
      jobs: {
        [key: string]: {
          environment: string;
          if: string;
          env: { [key: string]: string };
        };
      };
    };
    const job = workflow.jobs['backup-and-restore']!;

    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(workflow.on).toHaveProperty('schedule');
    expect(workflow.concurrency).toEqual({
      group: 'production-app-db-backup',
      'cancel-in-progress': false,
    });
    expect(job.environment).toBe('Production');
    expect(job.if).toContain("vars.APP_DB_BACKUP_ENABLED == 'true'");
    const expressionPrefix = '$';
    expect(job.env).toMatchObject({
      APP_DB_BACKUP_ENVIRONMENT: 'production',
      R2_CATALOG_BUCKET: `${expressionPrefix}{{ vars.R2_CATALOG_BUCKET }}`,
    });
    expect(source).not.toContain('sungrid-staging');
  });
});
