import { S3Client } from '@aws-sdk/client-s3';

import { createR2AppDatabaseBackupStore } from './r2BackupStore.js';

export function createHostedR2BackupRuntime(environment: NodeJS.ProcessEnv) {
  const deploymentEnvironment = required(
    environment,
    'APP_DB_BACKUP_ENVIRONMENT',
  );
  if (
    deploymentEnvironment !== 'staging' &&
    deploymentEnvironment !== 'production'
  )
    throw new Error('APP_DB_BACKUP_ENVIRONMENT must be staging or production');
  const environmentName: 'staging' | 'production' = deploymentEnvironment;
  const accountId = required(environment, 'CLOUDFLARE_ACCOUNT_ID');
  if (!/^[a-f\d]{32}$/u.test(accountId))
    throw new Error('CLOUDFLARE_ACCOUNT_ID is invalid');
  const bucket = required(environment, 'R2_BACKUP_BUCKET');
  const client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: required(environment, 'R2_BACKUP_ACCESS_KEY_ID'),
      secretAccessKey: required(environment, 'R2_BACKUP_SECRET_ACCESS_KEY'),
    },
  });
  const namespace = `${environmentName}/app-db/`;
  return {
    client,
    deploymentEnvironment: environmentName,
    namespace,
    store: createR2AppDatabaseBackupStore(client, bucket, namespace),
  };
}

export function required(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`env config missing: ${name}`);
  return value;
}
