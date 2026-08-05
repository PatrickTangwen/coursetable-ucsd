/**
 * CLI entrypoint for the one-command ETL refresh. See ./runRefresh.ts for
 * the orchestrated sequence and docs/etl_refresh.md for operations notes.
 *
 * Usage:
 *   bun tools/etl/run-refresh.mts [--config config/catalog-snapshot.ucsd.yaml]
 *
 * Traces are exported when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */

import { runEtlRefresh } from './runRefresh.js';
import { startEtlTelemetry } from './telemetry.js';
import { loadCatalogSnapshotConfig } from '../catalog-snapshot/catalogSnapshot.js';

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

const shutdownTelemetry = await startEtlTelemetry();
try {
  const config = await loadCatalogSnapshotConfig(
    argument('--config', 'config/catalog-snapshot.ucsd.yaml'),
  );
  const result = await runEtlRefresh({ config });
  console.log(
    JSON.stringify(
      {
        generated_at: result.generatedAt,
        schedule_of_classes_terms: result.scheduleOfClassesTerms,
        classplanner_terms: result.classplannerTerms,
        supported_terms: result.supportedTerms,
        report_json: result.reportPaths.jsonPath,
        report_markdown: result.reportPaths.markdownPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await shutdownTelemetry();
}
