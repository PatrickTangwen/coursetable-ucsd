import postgres from 'postgres';

function quoteIdentifier(identifier: string) {
  if (!identifier || /[\0\r\n]/u.test(identifier))
    throw new Error('App DB backup role is invalid');
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function backupRoleGrantStatements(role: string) {
  const backupRole = quoteIdentifier(role);
  return [
    `GRANT USAGE ON SCHEMA public, drizzle TO ${backupRole}`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO ${backupRole}`,
    `GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO ${backupRole}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${backupRole}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${backupRole}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON TABLES TO ${backupRole}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON SEQUENCES TO ${backupRole}`,
  ];
}

export async function prepareAppDatabaseBackupRole(
  backupDatabaseUrl: string,
  migrationDatabaseUrl: string,
) {
  assertSameDatabaseTarget(backupDatabaseUrl, migrationDatabaseUrl);
  const role = await readCurrentRole(backupDatabaseUrl);
  const migrationClient = postgres(migrationDatabaseUrl, {
    max: 1,
    onnotice() {},
  });
  try {
    for (const statement of backupRoleGrantStatements(role))
      await migrationClient.unsafe(statement);
  } finally {
    await migrationClient.end();
  }

  return {
    result: 'prepared' as const,
    schemas: ['public', 'drizzle'] as const,
  };
}

export function assertSameDatabaseTarget(
  backupDatabaseUrl: string,
  migrationDatabaseUrl: string,
) {
  const backup = databaseTarget(backupDatabaseUrl);
  const migration = databaseTarget(migrationDatabaseUrl);
  if (
    backup.hostname !== migration.hostname ||
    backup.port !== migration.port ||
    backup.database !== migration.database
  )
    throw new Error('App DB backup and migration targets do not match');
}

function databaseTarget(databaseUrl: string) {
  const connection = new URL(databaseUrl);
  if (connection.protocol !== 'postgresql:' || !connection.hostname)
    throw new Error('App DB backup target is invalid');
  const database = decodeURIComponent(connection.pathname.slice(1));
  if (!database || /[\0\r\n]/u.test(database))
    throw new Error('App DB backup target is invalid');
  return {
    database,
    hostname: connection.hostname,
    port: connection.port || '5432',
  };
}

async function readCurrentRole(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1, onnotice() {} });
  try {
    const [identity] = await client<{ role: string }[]>`
      select current_user::text as role
    `;
    if (!identity) throw new Error('App DB backup role identity is missing');
    const { role } = identity;
    return role;
  } finally {
    await client.end();
  }
}
