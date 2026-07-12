import { runAppDatabaseMigrationCommand } from './migrationCommand.js';

const databaseUrl = process.env.NEON_DIRECT_DATABASE_URL;
if (!databaseUrl)
  throw new Error('env config missing: NEON_DIRECT_DATABASE_URL');

await runAppDatabaseMigrationCommand(databaseUrl);
