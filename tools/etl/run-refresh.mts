/**
 * CLI entrypoint for the one-command ETL refresh. See ./runRefresh.ts for
 * the orchestrated sequence and docs/etl_refresh.md for operations notes.
 *
 * Usage:
 *   bun tools/etl/run-refresh.mts [--config config/catalog-snapshot.ucsd.yaml]
 *     [--result-path <file>] [--grade-archive reuse|live]
 *     [--grade-archive-session <file>]
 *
 * --result-path writes the machine-readable run summary to a file so callers
 * (the scheduled-refresh wrapper) do not have to parse mixed stdout.
 * --grade-archive selects the Instructor Grade Archive mode (ADR 0045):
 * `reuse` (default) serves it from the newest prior normalized run without
 * network access; `live` fetches it behind the operator's UCSD Single Sign-On
 * cookie read from --grade-archive-session (default
 * ~/.coursetable-etl/grade-archive-session; see docs/etl_refresh.md).
 * Traces are exported when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */

import { writeFile } from 'node:fs/promises';
import { loadDataRetentionPolicy } from './dataRetention.js';
import {
  defaultInstructorGradeArchiveSessionPath,
  loadInstructorGradeArchiveSession,
} from './gradeArchiveSession.js';
import {
  runEtlRefresh,
  type InstructorGradeArchiveMode,
} from './runRefresh.js';
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

async function instructorGradeArchiveMode(): Promise<InstructorGradeArchiveMode> {
  const mode = argument('--grade-archive', 'reuse');
  if (mode === 'reuse') return { mode: 'reuse' };
  if (mode !== 'live')
    throw new Error(`--grade-archive must be reuse or live, got ${mode}`);
  const sessionPath = argument(
    '--grade-archive-session',
    defaultInstructorGradeArchiveSessionPath,
  );
  const sessionCookie = await loadInstructorGradeArchiveSession(sessionPath);
  if (!sessionCookie) {
    throw new Error(
      `--grade-archive live needs a session file at ${sessionPath}; ` +
        'run bun tools/etl/capture-grade-archive-session.mts first',
    );
  }
  console.log(`Instructor Grade Archive session: ${sessionPath}`);
  return { mode: 'live', sessionCookie };
}

const shutdownTelemetry = await startEtlTelemetry();
try {
  const config = await loadCatalogSnapshotConfig(
    argument('--config', 'config/catalog-snapshot.ucsd.yaml'),
  );
  const retentionPolicy = await loadDataRetentionPolicy(
    argument('--retention-config', 'config/etl-retention.json'),
  );
  const result = await runEtlRefresh({
    config,
    retentionPolicy,
    instructorGradeArchive: await instructorGradeArchiveMode(),
  });
  const summary = {
    generated_at: result.generatedAt,
    schedule_of_classes_terms: result.scheduleOfClassesTerms,
    classplanner_terms: result.classplannerTerms,
    supported_terms: result.supportedTerms,
    totals: result.report.totals,
    report_json: result.reportPaths.jsonPath,
    report_markdown: result.reportPaths.markdownPath,
    retention: {
      raw_runs_removed: result.retention.removedRawRuns.length,
      normalized_runs_removed: result.retention.removedNormalizedRuns.length,
      runs_retained: result.retention.retainedRuns.length,
      missing_pins: result.retention.missingPinnedRuns,
    },
  };
  if (process.argv.includes('--result-path')) {
    await writeFile(
      argument('--result-path'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
  }
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await shutdownTelemetry();
}
