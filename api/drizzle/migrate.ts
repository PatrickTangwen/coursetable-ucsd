import { runAppDatabaseMigrationCommand } from './migrationCommand.js';

const databaseUrl = process.env.DB_URL;
if (!databaseUrl) throw new Error('env config missing: DB_URL');

await runAppDatabaseMigrationCommand(databaseUrl);
