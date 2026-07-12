import { runAppDatabaseMigrations } from './migrationRunner.js';

const databaseUrl = process.env.DB_URL;
if (!databaseUrl) throw new Error('env config missing: DB_URL');

await runAppDatabaseMigrations(databaseUrl);
