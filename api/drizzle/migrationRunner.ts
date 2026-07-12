import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runAppDatabaseMigrations(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1, onnotice() {} });
  const db = drizzle(client);
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL('./migrations/', import.meta.url),
      ),
    });
    return await readAppDatabaseSchemaVersion(client);
  } finally {
    await client.end();
  }
}

export async function readAppDatabaseSchemaVersion(client: postgres.Sql) {
  const [latest] = await client<{ createdAt: string }[]>`
    select created_at::text as "createdAt"
    from drizzle.__drizzle_migrations
    order by created_at desc
    limit 1
  `;
  if (!latest) throw new Error('App DB has no applied migration');

  const journal = JSON.parse(
    await readFile(
      new URL('./migrations/meta/_journal.json', import.meta.url),
      'utf8',
    ),
  ) as { entries?: { tag?: unknown; when?: unknown }[] };
  const entry = journal.entries?.find(
    (candidate) => String(candidate.when) === latest.createdAt,
  );
  if (!entry || typeof entry.tag !== 'string')
    throw new Error('App DB migration version is not in the local journal');
  return entry.tag;
}
