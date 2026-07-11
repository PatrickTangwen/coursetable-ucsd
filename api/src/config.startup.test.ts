import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const coreEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  API_PORT: '0',
  DB_URL: 'postgresql://localhost/app',
  ENABLED_API_MODULES: '',
  FRONTEND_ENDPOINT: 'http://localhost:3001',
  NODE_ENV: 'development',
  OVERWRITE_CATALOG: 'false',
  REDIS_HOST: 'localhost',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: 'test',
  SESSION_SECRET: 'startup-test-session-secret',
  TRUSTED_PROXY_CIDRS: '',
  VERIFICATION_ATTEMPT_EMAIL_LIMIT: '5',
  VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS: '60',
  VERIFICATION_ATTEMPT_SOURCE_LIMIT: '5',
  VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS: '60',
  VERIFICATION_GLOBAL_LIMIT: '10',
  VERIFICATION_GLOBAL_WINDOW_SECONDS: '60',
  VERIFICATION_REQUEST_COOLDOWN_SECONDS: '1',
  VERIFICATION_SOURCE_LIMIT: '5',
  VERIFICATION_SOURCE_WINDOW_SECONDS: '60',
};

async function importConfig(environment = coreEnvironment) {
  try {
    const { stderr } = await execFileAsync(
      'bun',
      ['-e', "await import('./src/config.ts')"],
      {
        cwd: import.meta.dirname.replace('/src', ''),
        env: environment,
      },
    );
    return { exitCode: 0, stderr };
  } catch (error) {
    const failure = error as { code?: number; stderr?: string };
    return { exitCode: failure.code ?? 1, stderr: failure.stderr ?? '' };
  }
}

describe('Core App Backend startup configuration', () => {
  it('loads without any legacy or Course Data Platform configuration', async () => {
    const result = await importConfig();
    expect(result).toEqual({ exitCode: 0, stderr: '' });
  });

  it('fails closed when the Course Data Platform is enabled without configuration', async () => {
    const result = await importConfig({
      ...coreEnvironment,
      ENABLED_API_MODULES: 'course-data-platform',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('env config missing: GRAPHQL_ENDPOINT');
  });

  it('fails closed when a legacy GraphQL module lacks its explicit platform dependency', async () => {
    const result = await importConfig({
      ...coreEnvironment,
      ENABLED_API_MODULES: 'friends',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      'optional API module requires course-data-platform: friends',
    );
  });

  it.each([
    {
      modules: 'canny',
      expected: 'env config missing: CANNY_KEY',
    },
    {
      modules: 'legacy-auth',
      expected: 'env config missing: YALIES_API_KEY',
    },
    {
      modules: 'course-data-platform,challenge',
      environment: {
        GRAPHQL_ENDPOINT: 'http://graphql.invalid/v1/graphql',
        HASURA_GRAPHQL_ADMIN_SECRET: 'startup-test-hasura-secret',
      },
      expected: 'env config missing: CHALLENGE_PASSWORD',
    },
    {
      modules: 'course-data-platform,legacy-catalog',
      environment: {
        GRAPHQL_ENDPOINT: 'http://graphql.invalid/v1/graphql',
        HASURA_GRAPHQL_ADMIN_SECRET: 'startup-test-hasura-secret',
      },
      expected: 'env config missing: FERRY_RELOAD_SECRET',
    },
  ])(
    'fails closed when $modules is missing required configuration',
    async ({ modules, environment = {}, expected }) => {
      const result = await importConfig({
        ...coreEnvironment,
        ...environment,
        ENABLED_API_MODULES: modules,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(expected);
    },
  );

  it('loads a fully configured optional legacy module', async () => {
    const result = await importConfig({
      ...coreEnvironment,
      ENABLED_API_MODULES: 'legacy-auth',
      YALIES_API_KEY: 'startup-test-yalies-key',
    });
    expect(result).toEqual({ exitCode: 0, stderr: '' });
  });
});
