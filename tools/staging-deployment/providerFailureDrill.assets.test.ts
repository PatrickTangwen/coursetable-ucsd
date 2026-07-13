import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { hostedProviderFailureDrills } from './providerFailureDrill.js';

const root = path.resolve(process.cwd());

describe('hosted provider failure drill workflow', () => {
  it('is protected, main-reachable, reversible, and privacy-safe', async () => {
    const source = await readFile(
      path.join(root, '.github/workflows/hosted-provider-failure-drill.yml'),
      'utf8',
    );
    const restoreSource = await readFile(
      path.join(root, 'tools/staging-deployment/restoreLastAccepted.mts'),
      'utf8',
    );
    const workflow = parse(source) as {
      on: {
        workflow_dispatch: {
          inputs: { provider: { options: string[] } };
        };
      };
      jobs: {
        [name: string]: {
          environment?: string;
          needs?: string;
          'timeout-minutes'?: number;
          steps: {
            name?: string;
            if?: string;
            run?: string;
            'timeout-minutes'?: number;
          }[];
        };
      };
    };
    const preflight = workflow.jobs.preflight!;
    const job = workflow.jobs['drill-and-restore']!;

    expect(workflow.on.workflow_dispatch.inputs.provider.options).toEqual(
      hostedProviderFailureDrills,
    );
    expect(preflight.environment).toBeUndefined();
    expect(job).toMatchObject({ environment: 'Staging', needs: 'preflight' });
    expect(source).toContain('git merge-base --is-ancestor');
    expect(source).toContain('writeProviderFailureDrillSecrets.mts');
    expect(source).toContain('runHostedProviderFailureDrill.mts');
    expect(source).toContain('verifyProviderFailureDrillCommit.mts');
    expect(source).toContain('restoreActiveWorkerToLastAccepted.mts');
    expect(source).toContain('smokeHostedStaging.mts');
    expect(job['timeout-minutes']).toBe(30);
    expect(Object.keys(workflow.jobs)).toEqual([
      'preflight',
      'drill-and-restore',
    ]);
    const drill = job.steps.find(
      ({ name }) => name === 'Deploy, exercise, and restore',
    )!;
    expect(drill['timeout-minutes']).toBeLessThan(job['timeout-minutes']!);
    expect(drill.run).toContain('set +e');
    expect(drill.run).toContain('"$restore_attempts" -lt 2');
    expect(drill.run).toContain("trap 'finish $?' EXIT");
    expect(drill.run).toContain('timeout --signal=TERM 120s');
    expect(drill.run).toContain('"$restore_attempts" -gt 2');
    expect(source).not.toContain('@ucsd.edu');
    expect(restoreSource.indexOf('restoreWorkerVersion({')).toBeGreaterThan(-1);
    expect(restoreSource.indexOf('restoreWorkerVersion({')).toBeLessThan(
      restoreSource.indexOf("'catalogR2.mts'), 'restore'"),
    );
  });
});
