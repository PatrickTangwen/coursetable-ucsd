import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import pathModule from 'node:path';
import type { CatalogSnapshot } from './catalogSnapshot';

export type SupportedTermEntry = {
  term: string;
  label: string;
  date_range: CatalogSnapshot['term_date_range'];
  frozen: boolean;
  generated_at: string;
  snapshot_path: string;
  manifest_path: string | null;
};

/**
 * The Supported Term registry advertised at `metadata.json`. It replaces the
 * single-term metadata pointer: the frontend term selector is driven by this
 * list of Supported Terms (UCSD alpha codes). See ADR 0012.
 */
export type SupportedTermRegistry = {
  last_update: string;
  terms: SupportedTermEntry[];
};

export function supportedTermSnapshotPath(term: string): string {
  return `catalogs/public/${term}.json`;
}

export function buildSupportedTermRegistry(
  entries: SupportedTermEntry[],
  lastUpdate: string,
): SupportedTermRegistry {
  return {
    last_update: lastUpdate,
    terms: entries,
  };
}

export async function writeSupportedTermRegistry(
  registry: SupportedTermRegistry,
  metadataPath: string,
): Promise<string> {
  await mkdir(pathModule.dirname(metadataPath), { recursive: true });
  const tempPath = `${metadataPath}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  try {
    await writeFile(
      tempPath,
      `${JSON.stringify(registry, null, 2)}\n`,
      'utf-8',
    );
    await rename(tempPath, metadataPath);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }
  return metadataPath;
}
