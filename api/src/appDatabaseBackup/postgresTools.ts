import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { readAppDatabaseSchemaVersionAtUrl } from '../../drizzle/migrationRunner.js';

const execFileAsync = promisify(execFile);

export interface SchemaConsistentDumpSource {
  schemaDatabaseUrl: string;
  dumpDatabaseUrl: string;
}

export async function createSchemaConsistentDump(
  source: SchemaConsistentDumpSource,
  destination: string,
) {
  const schemaVersionBeforeDump = await readAppDatabaseSchemaVersionAtUrl(
    source.schemaDatabaseUrl,
  );
  await createPostgresCustomDump(source.dumpDatabaseUrl, destination);
  const schemaVersion = await readAppDatabaseSchemaVersionAtUrl(
    source.schemaDatabaseUrl,
  );
  if (schemaVersion !== schemaVersionBeforeDump)
    throw new Error('App DB schema changed while its backup was created');
  return schemaVersion;
}

export async function createPostgresCustomDump(
  databaseUrl: string,
  destination: string,
) {
  await withPostgresService(databaseUrl, 'backup', async (service) => {
    try {
      await runPostgresTool(
        'pg_dump',
        [
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--file',
          service.artifactPath(destination),
          '--dbname=service=sungrid_app_db',
        ],
        service,
        destination,
      );
    } catch {
      throw new Error('PostgreSQL custom dump failed', {
        cause: new Error('PostgreSQL tool exited unsuccessfully'),
      });
    }
  });
}

export async function restorePostgresCustomDump(
  dumpPath: string,
  databaseUrl: string,
) {
  await withPostgresService(databaseUrl, 'restore', async (service) => {
    try {
      await runPostgresTool(
        'pg_restore',
        [
          '--exit-on-error',
          '--no-owner',
          '--no-privileges',
          '--dbname=service=sungrid_app_db',
          service.artifactPath(dumpPath),
        ],
        service,
        dumpPath,
      );
    } catch {
      throw new Error('PostgreSQL custom restore failed', {
        cause: new Error('PostgreSQL tool exited unsuccessfully'),
      });
    }
  });
}

async function withPostgresService(
  databaseUrl: string,
  operation: string,
  run: (service: PostgresService) => Promise<void>,
) {
  if (!databaseUrl.startsWith('postgresql://') || /[\r\n]/u.test(databaseUrl))
    throw new Error(`PostgreSQL ${operation} connection is invalid`);
  const connection = new URL(databaseUrl);
  const databaseName = decodeURIComponent(connection.pathname.slice(1));
  const password = decodeURIComponent(connection.password);
  if (!connection.hostname || !connection.username || !databaseName)
    throw new Error(`PostgreSQL ${operation} connection is invalid`);
  const directory = await mkdtemp(
    path.join(os.tmpdir(), `sungrid-pg-${operation}-`),
  );
  const serviceFile = path.join(directory, 'pg_service.conf');
  try {
    await writeFile(
      serviceFile,
      postgresServiceFile(connection, databaseName),
      { mode: 0o600 },
    );
    await run({
      directory,
      environment: {
        ...process.env,
        PGSERVICEFILE: serviceFile,
        PGCONNECT_TIMEOUT: '30',
        PGPASSWORD: password,
      },
      artifactPath(artifact) {
        return process.env.APP_DB_POSTGRES_TOOLS_IMAGE
          ? `/artifact/${path.basename(artifact)}`
          : artifact;
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function postgresServiceFile(connection: URL, databaseName: string) {
  const values = {
    host: connection.hostname,
    port: connection.port || '5432',
    user: decodeURIComponent(connection.username),
    dbname: databaseName,
    sslmode: connection.searchParams.get('sslmode') ?? undefined,
    channel_binding:
      connection.searchParams.get('channel_binding') ?? undefined,
  };
  const lines = Object.entries(values)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${serviceValue(value)}`);
  return `[sungrid_app_db]\n${lines.join('\n')}\n`;
}

function serviceValue(value: string) {
  if (/[\r\n]/u.test(value))
    throw new Error('PostgreSQL connection is invalid');
  return value;
}

interface PostgresService {
  directory: string;
  environment: NodeJS.ProcessEnv;
  artifactPath: (artifact: string) => string;
}

async function runPostgresTool(
  executable: 'pg_dump' | 'pg_restore',
  args: string[],
  service: PostgresService,
  artifact: string,
) {
  const image = process.env.APP_DB_POSTGRES_TOOLS_IMAGE;
  if (!image) {
    await execFileAsync(executable, args, { env: service.environment });
    return;
  }
  if (!/^postgres:\d+(?:\.\d+)?$/u.test(image))
    throw new Error('PostgreSQL tools image is invalid');
  const network = process.env.APP_DB_POSTGRES_DOCKER_NETWORK;
  if (network && !/^[\w.-]+$/u.test(network))
    throw new Error('PostgreSQL tools Docker network is invalid');
  const dockerArgs = [
    'run',
    '--rm',
    '--user',
    `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    ...(network ? ['--network', network] : []),
    '-e',
    'PGSERVICEFILE=/service/pg_service.conf',
    '-e',
    'PGCONNECT_TIMEOUT=30',
    '-e',
    'PGPASSWORD',
    '-v',
    `${service.directory}:/service:ro`,
    '-v',
    `${path.dirname(artifact)}:/artifact`,
    image,
    executable,
    ...args,
  ];
  await execFileAsync('docker', dockerArgs, { env: service.environment });
}
