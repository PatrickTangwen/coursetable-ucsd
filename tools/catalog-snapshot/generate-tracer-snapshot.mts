import {
  buildTracerCatalogSnapshot,
  loadCatalogSnapshotConfig,
  publishCatalogSnapshot,
} from './catalogSnapshot.js';

function readConfigPath() {
  const index = process.argv.indexOf('--config');
  if (index === -1) return 'config/catalog-snapshot.ucsd.yaml';
  const value = process.argv[index + 1];
  if (!value) throw new Error('--config requires a path');
  return value;
}

const config = await loadCatalogSnapshotConfig(readConfigPath());
const snapshot = buildTracerCatalogSnapshot(config);
const result = await publishCatalogSnapshot(snapshot, config);

console.log(
  JSON.stringify(
    {
      run_id: snapshot.run_id,
      active_planning_term: snapshot.active_planning_term,
      snapshot_path: result.snapshotPath,
      metadata_path: result.metadataPath,
    },
    null,
    2,
  ),
);
