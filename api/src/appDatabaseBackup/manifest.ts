import { z } from 'zod';

export const appDatabaseBackupManifestSchema = z.object({
  formatVersion: z.literal(1),
  backupTime: z.string().datetime({ offset: true }),
  dumpKey: z.string().min(1),
  environment: z.enum(['staging', 'production']),
  schemaVersion: z.string().regex(/^\d{4}_[a-z\d_]+$/u),
  sha256: z.string().regex(/^[a-f\d]{64}$/u),
  size: z.number().int().positive(),
  taskVersion: z.string().regex(/^\d+$/u),
});

export type AppDatabaseBackupManifest = z.infer<
  typeof appDatabaseBackupManifestSchema
>;

export function manifestKeyForDump(dumpKey: string) {
  if (!dumpKey.endsWith('.dump'))
    throw new Error('App DB backup dump key must end in .dump');
  return `${dumpKey.slice(0, -'.dump'.length)}.manifest.json`;
}
