import { loadCatalogSnapshotConfig } from './catalogSnapshot.js';
import { runTssPublishedSnapshotPipeline } from './tssPublishedSnapshotPipeline.js';

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} requires a value`);
  }
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function inferredMetadataTimestamp(directory: string): string | null {
  const match = /multi-(?<timestamp>\d{4}-\d{2}-\d{2}T[^/]+?Z)-/u.exec(
    directory,
  );
  return match?.groups?.timestamp ?? null;
}

try {
  const config = await loadCatalogSnapshotConfig(
    argument('--config', 'config/catalog-snapshot.ucsd.yaml'),
  );
  const rawDirectory = argument('--raw-dir');
  const metadataDirectory = argument('--metadata-dir');
  const metadataSourceTimestamp = process.argv.includes('--metadata-timestamp')
    ? argument('--metadata-timestamp')
    : inferredMetadataTimestamp(metadataDirectory);
  if (!metadataSourceTimestamp) {
    throw new Error(
      '--metadata-timestamp is required when it cannot be inferred from the metadata directory',
    );
  }
  const result = await runTssPublishedSnapshotPipeline({
    config,
    rawDirectory,
    metadataDirectory,
    metadataSourceTimestamp,
  });
  console.log(
    JSON.stringify(
      {
        run_id: result.snapshot.run_id,
        active_planning_term: result.snapshot.active_planning_term,
        coverage: result.snapshot.coverage,
        snapshot_path: result.snapshotPath,
        metadata_path: result.metadataPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
