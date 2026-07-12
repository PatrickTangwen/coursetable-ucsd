import type { AppDatabaseBackupManifest } from './manifest.js';

export interface StoredBackupDump {
  size: number;
  metadata: { [key: string]: string };
}

export interface AppDatabaseBackupStore {
  putDump: (input: {
    key: string;
    path: string;
    metadata: { [key: string]: string };
  }) => Promise<StoredBackupDump>;
  putManifest: (manifest: AppDatabaseBackupManifest) => Promise<void>;
  listManifests: () => Promise<AppDatabaseBackupManifest[]>;
  downloadDump: (key: string, destination: string) => Promise<StoredBackupDump>;
  removeBackups: (manifests: AppDatabaseBackupManifest[]) => Promise<void>;
}
