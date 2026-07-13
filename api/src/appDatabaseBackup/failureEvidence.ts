export const appDatabaseBackupStages = [
  'initialize',
  'create-dump',
  'publish-backup',
] as const;

export type AppDatabaseBackupStage = (typeof appDatabaseBackupStages)[number];

export function appDatabaseBackupFailureEvidence(
  stage: AppDatabaseBackupStage,
) {
  return { result: 'failure' as const, stage };
}
