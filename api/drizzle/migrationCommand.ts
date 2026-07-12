import { runAppDatabaseMigrations } from './migrationRunner.js';

export async function runAppDatabaseMigrationCommand(databaseUrl: string) {
  try {
    const schemaVersion = await runAppDatabaseMigrations(databaseUrl);
    process.stdout.write(`${JSON.stringify({ schemaVersion })}\n`);
  } catch {
    throw new Error('App DB migration failed');
  }
}
