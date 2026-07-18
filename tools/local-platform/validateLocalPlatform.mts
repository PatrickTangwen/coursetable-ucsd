import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  createRunConfig,
  inspectComposeProject,
  runCompose,
  runValidation,
} from '../real-backend-auth-validation/validateRealBackendAuth.mjs';

const execFileAsync = promisify(execFile);

function argumentEnabled(name: string) {
  return process.argv.slice(2).includes(name);
}

function secret() {
  return randomBytes(24).toString('hex');
}

function composeCommand(withPgAdmin: boolean, command: string[]) {
  return withPgAdmin ? ['--profile', 'admin', ...command] : command;
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Could not allocate a disposable TCP port');
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function verifyCourseDataFailureCleanup(
  rootDir: string,
  runToken: string,
) {
  const project = `course-data-failure-${runToken}`;
  const temporaryDirectoriesBefore = new Set(
    (await readdir(os.tmpdir())).filter((name) =>
      name.startsWith('course-data-tracer-'),
    ),
  );
  const environment = {
    ...process.env,
    COURSE_DATA_TRACER_PROJECT: project,
    COURSE_DATA_STORE_PORT: String(await allocatePort()),
    COURSE_DATA_HASURA_PORT: String(await allocatePort()),
    COURSE_DATA_PUBLIC_GRAPHQL_PORT: String(await allocatePort()),
    STATIC_CATALOG_SMOKE_PORT: String(await allocatePort()),
    COURSE_DATA_TRACER_FAILURE_PROBE: 'after-up',
  };
  const failure = await execFileAsync(
    'bun',
    ['tools/course-data-store/validateCourseDataTracer.mts'],
    { cwd: rootDir, env: environment, maxBuffer: 20 * 1024 * 1024 },
  ).then(
    () => null,
    (error: unknown) => error as { stderr?: string },
  );
  if (!failure?.stderr?.includes('Injected Course Data tracer failure')) {
    throw new Error(
      'Course Data failure cleanup probe did not fail as expected',
    );
  }

  const resourceQueries = [
    [
      'ps',
      '-a',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--format',
      '{{.Names}}',
    ],
    [
      'volume',
      'ls',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--format',
      '{{.Name}}',
    ],
    [
      'network',
      'ls',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--format',
      '{{.Name}}',
    ],
  ];
  for (const query of resourceQueries) {
    const { stdout } = await execFileAsync('docker', query);
    if (stdout.trim())
      throw new Error('Course Data failure cleanup left Docker resources');
  }
  const temporaryDirectoriesAfter = (await readdir(os.tmpdir())).filter(
    (name) =>
      name.startsWith('course-data-tracer-') &&
      !temporaryDirectoriesBefore.has(name),
  );
  if (temporaryDirectoriesAfter.length > 0)
    throw new Error('Course Data failure cleanup left temporary artifacts');
  return true;
}

export async function validateLocalPlatform() {
  const rootDir = path.resolve(import.meta.dirname, '../..');
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'sungrid-local-platform-'),
  );
  const runToken = randomBytes(6).toString('hex');
  const composeProject = `sungrid-platform-${runToken}`;
  const withPgAdmin = argumentEnabled('--with-pgadmin');
  const apiPort = await allocatePort();
  const pgAdminPort = await allocatePort();
  const courseDataStorePort = await allocatePort();
  const hasuraPort = await allocatePort();
  const publicGraphqlPort = await allocatePort();
  const staticCatalogPort = await allocatePort();
  const envPath = path.join(temporaryDirectory, 'platform.env');
  const artifactDir = path.join(temporaryDirectory, 'auth-evidence');
  const env = [
    `API_PORT=${apiPort}`,
    'DB_NAME=coursetable_app',
    'DB_USER=postgres',
    `DB_ROOT_PASSWORD=${secret()}`,
    'FRONTEND_ENDPOINT=http://localhost:3011',
    `SESSION_SECRET=${secret()}`,
    'TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    `PGADMIN_PORT=${pgAdminPort}`,
    'PGADMIN_EMAIL=operator@example.com',
    `PGADMIN_PASSWORD=${secret()}`,
  ].join('\n');
  await writeFile(envPath, `${env}\n`, { mode: 0o600 });

  const config = createRunConfig(
    [
      '--compose-project',
      composeProject,
      '--compose-env-file',
      envPath,
      '--artifact-dir',
      artifactDir,
      '--api-origin',
      `http://localhost:${apiPort}`,
    ],
    { COURSETABLE_AUTH_REPO_ROOT: rootDir },
  );
  let ownsAppStack = false;
  try {
    inspectComposeProject(
      await runCompose(config, ['ps', '-a', '--format', 'json']),
    );
    ownsAppStack = true;
    await runCompose(
      config,
      composeCommand(withPgAdmin, [
        'up',
        '-d',
        '--build',
        '--wait',
        '--remove-orphans',
      ]),
    );
    const appDbHealth = (
      await runCompose(config, [
        'exec',
        '-T',
        'db',
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'coursetable_app',
      ])
    ).includes('accepting connections');
    const redisHealth = (
      await runCompose(config, ['exec', '-T', 'redis', 'redis-cli', 'PING'])
    )
      .trim()
      .endsWith('PONG');
    if (!appDbHealth || !redisHealth)
      throw new Error('App DB or Redis health probe failed');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await runCompose(config, [
        'exec',
        '-T',
        'api',
        'bun',
        'run',
        'db:migrate',
      ]);
    }
    if (process.env.LOCAL_PLATFORM_FAILURE_PROBE === 'after-app-start')
      throw new Error('Injected local platform failure after App stack start');
    const hasuraUnavailable = await fetch(
      `http://127.0.0.1:${hasuraPort}/healthz`,
    )
      .then(() => false)
      .catch(() => true);
    if (!hasuraUnavailable) {
      throw new Error(
        'Hasura must be unavailable during App Backend validation',
      );
    }
    const auth = await runValidation(config);
    const courseDataFailureCleanup = await verifyCourseDataFailureCleanup(
      rootDir,
      runToken,
    );
    Object.assign(process.env, {
      COURSE_DATA_STORE_PORT: String(courseDataStorePort),
      COURSE_DATA_HASURA_PORT: String(hasuraPort),
      COURSE_DATA_PUBLIC_GRAPHQL_PORT: String(publicGraphqlPort),
      STATIC_CATALOG_SMOKE_PORT: String(staticCatalogPort),
      COURSE_DATA_TRACER_PROJECT: `course-data-tracer-${runToken}`,
    });
    const { validateCourseDataTracer } =
      await import('../course-data-store/validateCourseDataTracer.mjs');
    const courseData = await validateCourseDataTracer();
    return {
      result: 'passed',
      services: {
        coreAppBackend: true,
        appDb: true,
        redis: true,
        courseDataStore: true,
        hasura: true,
        pgAdmin: withPgAdmin,
      },
      ports: {
        api: apiPort,
        pgAdmin: withPgAdmin ? pgAdminPort : null,
        courseDataStore: courseDataStorePort,
        hasura: hasuraPort,
        publicGraphqlGateway: publicGraphqlPort,
        staticCatalogSmoke: staticCatalogPort,
      },
      appDbMigrationRerun: true,
      courseDataMigrationRerun: courseData.migrationRerun,
      appBackendIndependentOfHasura: true,
      hasuraUnavailableDuringAuth: hasuraUnavailable,
      staticCatalogIndependentOfHasura: true,
      authValidation: auth.result,
      courseDataParity: courseData.publishedSnapshotSemanticParity,
      frozenCourseDataParity: courseData.frozenSnapshotSemanticParity,
      failureCleanupVerified: courseDataFailureCleanup,
      health: {
        coreAppBackend: true,
        appDb: appDbHealth,
        redis: redisHealth,
        courseDataStore: courseData.health.courseDataStore,
        hasura: courseData.health.hasura,
        staticCatalog: courseData.health.staticCatalog,
      },
    };
  } finally {
    try {
      if (ownsAppStack) {
        await runCompose(
          config,
          composeCommand(withPgAdmin, [
            'down',
            '--volumes',
            '--remove-orphans',
          ]),
        );
      }
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
      for (const name of [
        'COURSE_DATA_STORE_PORT',
        'COURSE_DATA_HASURA_PORT',
        'COURSE_DATA_PUBLIC_GRAPHQL_PORT',
        'STATIC_CATALOG_SMOKE_PORT',
        'COURSE_DATA_TRACER_PROJECT',
      ])
        delete process.env[name];
    }
  }
}

if (import.meta.main)
  console.log(JSON.stringify(await validateLocalPlatform(), null, 2));
