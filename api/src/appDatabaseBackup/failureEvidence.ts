export const appDatabaseBackupStages = [
  'initialize',
  'read-schema-before-dump',
  'create-custom-dump',
  'read-schema-after-dump',
  'publish-backup',
] as const;

export type AppDatabaseBackupStage = (typeof appDatabaseBackupStages)[number];

export function appDatabaseBackupFailureEvidence(
  stage: AppDatabaseBackupStage,
) {
  return { result: 'failure' as const, stage };
}
