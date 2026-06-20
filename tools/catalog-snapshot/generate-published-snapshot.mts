import { loadCatalogSnapshotConfig } from './catalogSnapshot.js';
import { runPublishedSnapshotPipeline } from './publishedSnapshotPipeline.js';

function readConfigPath() {
  const index = process.argv.indexOf('--config');
  if (index === -1) return 'config/catalog-snapshot.ucsd.yaml';
  const value = process.argv[index + 1];
  if (!value) throw new Error('--config requires a path');
  return value;
}

try {
  const config = await loadCatalogSnapshotConfig(readConfigPath());
  const result = await runPublishedSnapshotPipeline(config);

  console.log(
    JSON.stringify(
      {
        run_id: result.report.run_id,
        active_planning_term: result.report.active_planning_term,
        configured_subjects: result.report.configured_subjects,
        status: result.report.status,
        snapshot_path: result.snapshotPath,
        metadata_path: result.metadataPath,
        report_path: result.reportPath,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
