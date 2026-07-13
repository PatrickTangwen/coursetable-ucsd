import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('hosted telemetry privacy assets', () => {
  it('configures explicit Sentry and Winston scrubbing', async () => {
    const [serverSentry, winston, browserSentry, browserApi] =
      await Promise.all([
        readFile(path.join(root, 'api/src/sentry-instrument.ts'), 'utf8'),
        readFile(path.join(root, 'api/src/logging/winston.ts'), 'utf8'),
        readFile(path.join(root, 'frontend/src/main.tsx'), 'utf8'),
        readFile(path.join(root, 'frontend/src/queries/api.ts'), 'utf8'),
      ]);

    expect(serverSentry).toContain('beforeSend: scrubGeneralTelemetry');
    expect(winston).toContain('scrubGeneralTelemetry');
    expect(browserSentry).toContain('sendDefaultPii: false');
    expect(browserSentry).toContain('beforeSend: scrubBrowserTelemetry');
    expect(browserSentry).toContain('beforeBreadcrumb: scrubBrowserTelemetry');
    expect(browserApi).not.toMatch(/Sentry\.setUser\(\{[^}]*email:/u);
  });

  it('keeps deployment workflows and shell scripts free of environment dumps and shell tracing', async () => {
    const workflowDirectory = path.join(root, '.github/workflows');
    const workflows = await readdir(workflowDirectory);
    const apiFiles = await readdir(path.join(root, 'api'), { recursive: true });
    const workerFiles = await readdir(path.join(root, 'worker'), {
      recursive: true,
    });
    const assetPaths = [
      ...workflows.map((file) => path.join('.github/workflows', file)),
      ...apiFiles
        .filter(
          (file) =>
            file === 'Dockerfile' ||
            file.endsWith('.sh') ||
            (file.startsWith('compose/') && /\.ya?ml$/u.test(file)),
        )
        .map((file) => path.join('api', file)),
      ...workerFiles
        .filter(
          (file) =>
            file.endsWith('.sh') ||
            (file.startsWith('scripts/') && /\.[cm]?[jt]s$/u.test(file)),
        )
        .map((file) => path.join('worker', file)),
      'package.json',
      'api/package.json',
    ];
    const assets = await Promise.all(
      assetPaths.map(async (file) => ({
        file,
        source: await readFile(path.join(root, file), 'utf8'),
      })),
    );
    const unsafeAssets = assets.filter(({ source }) =>
      source.split(/\r?\n/u).some(isUnsafeDeploymentLine),
    );

    expect(assetPaths).toContain('api/Dockerfile');
    expect(assetPaths).toContain('api/compose/local-validation-status.sh');
    expect(unsafeAssets.map(({ file }) => file)).toEqual([]);
    expect(isUnsafeDeploymentLine('set -x')).toBe(true);
    expect(isUnsafeDeploymentLine('printenv')).toBe(true);
    expect(isUnsafeDeploymentLine('console.log(process.env)')).toBe(true);
  });
});

function isUnsafeDeploymentLine(line: string) {
  const trimmed = line.trim();
  return (
    /^(?:set\s+-.*x|printenv(?:\s|$)|env\s*$|export\s+-p)/u.test(trimmed) ||
    /(?:console\.(?:log|error)|JSON\.stringify)\(\s*process\.env\b/u.test(
      trimmed,
    )
  );
}
