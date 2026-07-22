import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { thrownBy } from './testFailure';

describe('attended TSS capture output', () => {
  it('atomically replaces a permissive file with a private sanitized artifact', async () => {
    const { writePrivateArtifact } = await import('./capture-tss-schedule.mjs');
    const directory = await mkdtemp(join(tmpdir(), 'sungrid-tss-capture-'));
    const output = join(directory, 'FA26.json');
    try {
      await writeFile(output, '{"old":true}\n', { mode: 0o644 });
      await chmod(output, 0o644);

      await writePrivateArtifact(output, { schema_version: 'tss-schedule-v1' });

      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({
        schema_version: 'tss-schedule-v1',
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('tightens an existing profile and rejects symlinked profile paths', async () => {
    const { secureProfileDirectory } =
      await import('./capture-tss-schedule.mjs');
    const directory = await mkdtemp(
      join(homedir(), '.sungrid-tss-profile-test-'),
    );
    const profile = join(directory, 'profile');
    const linkedParent = join(directory, 'linked-parent');
    try {
      await mkdir(profile, { mode: 0o755 });
      await chmod(profile, 0o755);
      await secureProfileDirectory(profile);
      expect((await stat(profile)).mode & 0o777).toBe(0o700);

      await symlink(directory, linkedParent);
      await expect(
        secureProfileDirectory(join(linkedParent, 'nested-profile')),
      ).rejects.toThrow(/symbolic links/u);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects unknown OData envelope fields', async () => {
    const { parseODataEnvelope } = await import('./capture-tss-schedule.mjs');

    const error = thrownBy(() =>
      parseODataEnvelope({
        '@odata.count': 0,
        '@odata.deltaLink': 'unexpected',
        value: [],
      }),
    );

    expect(error).toMatchObject({
      report: {
        schema_version: 'tss-structural-drift-v1',
        contract: 'tss-odata-capture-v1',
        issues: [
          {
            kind: 'path',
            path: ['response', 'envelope'],
            expected: 'known_fields_only',
            observed: ['@odata.deltaLink'],
          },
        ],
      },
    });
  });

  it('reports continuation endpoint drift without echoing its URL', async () => {
    const { validatedContinuationUrl } =
      await import('./capture-tss-schedule.mjs');
    const secret = 'private-continuation-value-987';
    const initial =
      'https://tss.ucsd.edu/odata/modules?$select=ModuleID&$top=250';
    const continuation = `https://unexpected.example/${secret}?$select=ModuleID&$top=250&$skip=250`;
    const error = thrownBy(() =>
      validatedContinuationUrl(initial, continuation),
    );

    expect(error).toMatchObject({
      report: {
        issues: [
          {
            kind: 'endpoint',
            path: ['response', 'continuation'],
            expected: 'approved_paging_request',
          },
        ],
      },
    });
    expect(JSON.stringify(error)).not.toContain(secret);
  });

  it('reports response body and content-type drift without response values', async () => {
    const { formatTssCaptureError, parseTssODataPage } =
      await import('./capture-tss-schedule.mjs');
    const requestUrl = 'https://tss.ucsd.edu/approved';
    const secret = 'private-response-value-987';
    const failures = [
      {
        response: {
          body: secret,
          contentType: 'text/html',
          responseUrl: requestUrl,
          status: 200,
        },
        issue: {
          kind: 'type',
          path: ['response', 'content_type'],
          expected: 'application/json',
        },
      },
      {
        response: {
          body: `{${secret}`,
          contentType: 'application/json',
          responseUrl: requestUrl,
          status: 200,
        },
        issue: {
          kind: 'type',
          path: ['response', 'body'],
          expected: 'json_object',
        },
      },
    ];

    for (const { response, issue } of failures) {
      const error = thrownBy(() => parseTssODataPage(requestUrl, response));
      expect(error).toMatchObject({ report: { issues: [issue] } });
      expect(formatTssCaptureError(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });

  it('leaves no artifact or sensitive diagnostic when sanitization fails', async () => {
    const { formatTssCaptureError, runTssCaptureOutputBoundary } =
      await import('./capture-tss-schedule.mjs');
    const directory = await mkdtemp(join(tmpdir(), 'sungrid-tss-failure-'));
    const output = join(directory, 'FA26.json');
    const secret = 'student-or-account-value-987';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const succeeded = await runTssCaptureOutputBoundary(
        output,
        {
          term: 'FA26',
          sourceTerm: { academicYear: '2026', academicPeriod: '2' },
          requestedSubjects: ['CAT'],
          capturedAt: '2026-07-21T16:05:00.000Z',
          sourceUpdatedAt: null,
          sourceUpdatedAtProvenance: 'unavailable',
          modules: {
            declaredTotal: 0,
            pages: 1,
            continuationNeeded: false,
            rows: [],
          },
          events: {
            declaredTotal: 1,
            pages: 1,
            continuationNeeded: false,
            rows: [
              {
                Status: secret,
                StudentIdentifier: secret,
              },
            ],
          },
        },
        {
          stdout: (message) => stdout.push(message),
          stderr: (message) => stderr.push(message),
        },
      );
      expect(await readdir(directory)).toEqual([]);
      expect(log).not.toHaveBeenCalled();
      expect(errorLog).not.toHaveBeenCalled();
      expect(succeeded).toBe(false);
      expect(stdout).toEqual([]);
      expect(stderr).toHaveLength(1);
      expect(stderr[0]).toContain('tss-structural-drift-v1');
      expect(stderr.join('\n')).not.toContain(secret);
      expect(
        formatTssCaptureError(new Error(`unexpected ${secret}`)),
      ).not.toContain(secret);
    } finally {
      log.mockRestore();
      errorLog.mockRestore();
      await rm(directory, { force: true, recursive: true });
    }
  });
});
