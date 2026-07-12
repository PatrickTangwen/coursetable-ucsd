import { S3Client } from '@aws-sdk/client-s3';

import { getRequiredEnvironmentVariable } from './environment.js';
import { createR2AppDatabaseBackupStore } from './r2BackupStore.js';

export function createHostedR2BackupRuntime(environment: NodeJS.ProcessEnv) {
  const deploymentEnvironment = getRequiredEnvironmentVariable(
    environment,
    'APP_DB_BACKUP_ENVIRONMENT',
  );
  if (
    deploymentEnvironment !== 'staging' &&
    deploymentEnvironment !== 'production'
  )
    throw new Error('APP_DB_BACKUP_ENVIRONMENT must be staging or production');
  const environmentName: 'staging' | 'production' = deploymentEnvironment;
  const accountId = getRequiredEnvironmentVariable(
    environment,
    'CLOUDFLARE_ACCOUNT_ID',
  );
  if (!/^[a-f\d]{32}$/u.test(accountId))
    throw new Error('CLOUDFLARE_ACCOUNT_ID is invalid');
  const bucket = getRequiredEnvironmentVariable(
    environment,
    'R2_BACKUP_BUCKET',
  );
  const catalogBucket = getRequiredEnvironmentVariable(
    environment,
    'R2_CATALOG_BUCKET',
  );
  if (bucket === catalogBucket)
    throw new Error('App DB backups require a bucket separate from Catalog');
  const privateAccessVerifiedAt = getRequiredEnvironmentVariable(
    environment,
    'R2_BACKUP_PRIVATE_ACCESS_VERIFIED_AT',
  );
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      privateAccessVerifiedAt,
    )
  ) {
    throw new Error(
      'R2 backup private-access evidence must be a UTC timestamp',
    );
  }
  const client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: getRequiredEnvironmentVariable(
        environment,
        'R2_BACKUP_ACCESS_KEY_ID',
      ),
      secretAccessKey: getRequiredEnvironmentVariable(
        environment,
        'R2_BACKUP_SECRET_ACCESS_KEY',
      ),
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
