import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const composeDir = path.join(rootDir, 'api/compose');
const envTemplatePath = path.join(composeDir, 'local-validation.env.example');
const coreEnvTemplatePath = path.join(
  composeDir,
  'core-validation.env.example',
);
const coreComposePath = path.join(composeDir, 'core-validation-compose.yml');

const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), 'utf8');

const parseEnvKeys = (contents: string) =>
  new Set(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=', 1)[0]),
  );

const requiredComposeVars = (...relativePaths: string[]) =>
  new Set(
    relativePaths.flatMap((relativePath) =>
      [
        ...readRepoFile(relativePath).matchAll(/\$\{(?<name>[A-Z\d_]+)\?/gu),
      ].map((match) => match.groups?.name ?? ''),
    ),
  );

describe('real backend auth validation local compose assets', () => {
  it('keeps the Doppler-free env template aligned with required compose vars', () => {
    const envKeys = parseEnvKeys(readFileSync(envTemplatePath, 'utf8'));
    const requiredVars = requiredComposeVars(
      'api/compose/docker-compose.yml',
      'api/compose/dev-compose.yml',
      'api/compose/local-validation-compose.yml',
    );

    expect([...requiredVars].filter((key) => !envKeys.has(key))).toEqual([]);
  });

  it('runs local compose wrappers through docker compose with an explicit env file', () => {
    for (const scriptName of [
      'local-validation-up.sh',
      'local-validation-down.sh',
      'local-validation-status.sh',
      'local-validation-schema.sh',
    ]) {
      const script = readFileSync(path.join(composeDir, scriptName), 'utf8');

      expect(script).toContain('docker compose');
      expect(script).toContain('--env-file');
      expect(script).toContain('local-validation.env.example');
      expect(script).not.toContain('doppler');
    }
  });

  it('trusts only the fixed Linux and Docker Desktop gateways', () => {
    const coreEnv = readFileSync(coreEnvTemplatePath, 'utf8');
    const coreCompose = readFileSync(coreComposePath, 'utf8');

    expect(coreEnv).toContain(
      'TRUSTED_PROXY_CIDRS=172.31.85.1/32,192.168.65.1/32',
    );
    expect(coreCompose).toContain('subnet: 172.31.85.0/24');
  });

  it('keeps per-run validation artifacts out of git by default', () => {
    const ignoredPath =
      'artifacts/real-backend-auth-validation/example-run/evidence.txt';

    const output = execFileSync('git', ['check-ignore', ignoredPath], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();

    expect(output).toBe(ignoredPath);
  });
});
