import { runAppDatabaseMigrations } from './migrationRunner.js';

const databaseUrl = process.env.NEON_DIRECT_DATABASE_URL;
if (!databaseUrl)
  throw new Error('env config missing: NEON_DIRECT_DATABASE_URL');

try {
  const schemaVersion = await runAppDatabaseMigrations(databaseUrl);
  process.stdout.write(`${JSON.stringify({ schemaVersion })}\n`);
} catch {
  throw new Error('App DB migration failed');
}
