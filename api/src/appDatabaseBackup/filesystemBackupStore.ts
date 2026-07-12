import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type { AppDatabaseBackupStore } from './backupStore.js';
import {
  appDatabaseBackupManifestSchema,
  manifestKeyForDump,
} from './manifest.js';
import { isKeyInsideNamespace } from './retention.js';

export function createFilesystemAppDatabaseBackupStore(
  root: string,
  namespace: string,
): AppDatabaseBackupStore {
  const directory = path.join(root, namespace);
  const assertDumpKey = (key: string) => {
    if (!isKeyInsideNamespace(key, namespace)) {
      throw new Error(
        'Local backup object is outside the configured namespace',
      );
    }
  };
  const fileForKey = (key: string) => path.join(root, key);
  const metadataPath = (key: string) => `${fileForKey(key)}.metadata.json`;

  return {
    async putDump({ key, path: source, metadata }) {
      assertDumpKey(key);
      await mkdir(directory, { recursive: true });
      await copyFile(source, fileForKey(key));
      await writeFile(metadataPath(key), `${JSON.stringify(metadata)}\n`);
      return { size: (await stat(fileForKey(key))).size, metadata };
    },

    async putManifest(manifest) {
      assertDumpKey(manifest.dumpKey);
      await mkdir(directory, { recursive: true });
      await writeFile(
        fileForKey(manifestKeyForDump(manifest.dumpKey)),
        `${JSON.stringify(manifest)}\n`,
      );
    },

    async listManifests() {
      const files = await readdir(directory).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      });
      return Promise.all(
        files
          .filter((file) => file.endsWith('.manifest.json'))
          .map(async (file) =>
            appDatabaseBackupManifestSchema.parse(
              JSON.parse(await readFile(path.join(directory, file), 'utf8')),
            ),
          ),
      );
    },

    async downloadDump(key, destination) {
      assertDumpKey(key);
      await copyFile(fileForKey(key), destination);
      return {
        size: (await stat(destination)).size,
        metadata: JSON.parse(await readFile(metadataPath(key), 'utf8')) as {
          [key: string]: string;
        },
      };
    },

    async removeBackups(manifests) {
      for (const manifest of manifests) {
        assertDumpKey(manifest.dumpKey);
        await Promise.all([
          rm(fileForKey(manifest.dumpKey), { force: true }),
          rm(metadataPath(manifest.dumpKey), { force: true }),
          rm(fileForKey(manifestKeyForDump(manifest.dumpKey)), {
            force: true,
          }),
        ]);
      }
    },
  };
}
