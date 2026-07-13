import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(process.cwd());

describe('Cloudflare staging deployment assets', () => {
  it('declares the manual, main-reachable, protected staging workflow contract', async () => {
    const source = await readFile(
      path.join(root, '.github/workflows/cloudflare-staging-deploy.yml'),
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
            name?: string;
            run?: string;
          }[];
        };
      };
    };

    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs).toMatchObject({
      target: { required: true, type: 'choice', options: ['staging'] },
      commit: { required: true, type: 'string' },
      recover_unaccepted_first_deployment: {
        required: true,
        type: 'boolean',
        default: false,
      },
      recover_unaccepted_worker_version: {
        required: false,
        type: 'string',
        default: '',
      },
    });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'sungrid-staging-deployment',
      'cancel-in-progress': false,
    });

    const preflight = workflow.jobs.preflight!;
    const deploy = workflow.jobs.deploy!;
    const preflightReport = workflow.jobs['report-preflight-failure']!;
    expect(preflight.environment).toBeUndefined();
    expect(deploy.environment).toBe('Staging');
    expect(preflightReport.environment).toBe('Staging');
    expect(preflightReport.if).toContain("needs.preflight.result == 'failure'");
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(source).toContain(
      'git merge-base --is-ancestor "$SELECTED_COMMIT" origin/main',
    );
    const digitRange = '0-9';
    expect(source).toContain(`^[${digitRange}a-f]{40}$`);
    const expressionPrefix = '$';
    expect(source).toContain(`ref: ${expressionPrefix}{{ inputs.commit }}`);
    expect(source).toContain('fetch-depth: 0');
    expect(source).toContain(
      `NEON_MIGRATION_DATABASE_URL: ${expressionPrefix}{{ secrets.NEON_MIGRATION_DATABASE_URL }}`,
    );
    expect(source).not.toContain(
      `NEON_MIGRATION_DATABASE_URL: ${expressionPrefix}{{ secrets.NEON_DIRECT_DATABASE_URL }}`,
    );
    expect(deploy.env).not.toHaveProperty('CLOUDFLARE_API_TOKEN');
    expect(deploy.env).not.toHaveProperty('SESSION_SECRET');
    expect(deploy.env).not.toHaveProperty('VERIFICATION_EMAIL_FROM_ADDRESS');
    expect(source).not.toContain(
      `VERIFICATION_EMAIL_FROM_ADDRESS: ${expressionPrefix}{{ vars.VERIFICATION_EMAIL_FROM_ADDRESS }}`,
    );
    expect(source).toContain(
      `VERIFICATION_EMAIL_FROM_ADDRESS: ${expressionPrefix}{{ secrets.VERIFICATION_EMAIL_FROM_ADDRESS }}`,
    );
    expect(source).toContain('test "$APP_DB_BACKUP_ENABLED" = false');

    const build = deploy.steps.find(
      ({ name }) => name === 'Build Worker and static assets',
    );
    expect(build?.env).toEqual({ VITE_PUBLIC_LOGIN_ENABLED: 'true' });

    const orderedStages = deploy.steps.map(({ name }) => name).filter(Boolean);
    expect(orderedStages).toEqual(
      expect.arrayContaining([
        'Apply App DB migrations',
        'Capture durable last accepted deployment',
        'Prove active Worker matches last accepted deployment',
        'Publish and verify Term Archive',
        'Build Worker and static assets',
        'Deploy Worker and secrets',
        'Run hosted staging smoke',
        'Record accepted deployment',
        'Restore last accepted deployment on failure',
        'Report deployment outcome',
      ]),
    );
    expect(orderedStages.indexOf('Apply App DB migrations')).toBeLessThan(
      orderedStages.indexOf('Publish and verify Term Archive'),
    );
    expect(
      orderedStages.indexOf('Publish and verify Term Archive'),
    ).toBeLessThan(orderedStages.indexOf('Deploy Worker and secrets'));
    expect(orderedStages.indexOf('Deploy Worker and secrets')).toBeLessThan(
      orderedStages.indexOf('Run hosted staging smoke'),
    );
    expect(source).toContain('if: failure()');
    expect(source).toContain('last-accepted.json');
    expect(source).toContain('workerDeployment.mts verify-accepted');
    expect(source).toContain('recoverUnacceptedWorker.mts');
    expect(source).toContain(
      `if: ${expressionPrefix}{{ inputs.recover_unaccepted_first_deployment }}`,
    );
    expect(source).toContain(
      `RECOVER_UNACCEPTED_WORKER_VERSION: ${expressionPrefix}{{ inputs.recover_unaccepted_worker_version }}`,
    );
    expect(source).toContain('validate:failure-safety');
    expect(source).toContain('api/drizzle/test-migrate.sh');
  });
});
