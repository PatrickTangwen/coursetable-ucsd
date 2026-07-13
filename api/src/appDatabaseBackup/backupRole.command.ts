import { prepareAppDatabaseBackupRole } from './backupRole.js';
import { getRequiredEnvironmentVariable } from './environment.js';

try {
  const evidence = await prepareAppDatabaseBackupRole(
    getRequiredEnvironmentVariable(process.env, 'NEON_DIRECT_DATABASE_URL'),
    getRequiredEnvironmentVariable(process.env, 'NEON_MIGRATION_DATABASE_URL'),
  );
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch {
  throw new Error('App DB backup role preparation failed');
}
