import { randomUUID } from 'node:crypto';
import type { CatalogSnapshot, CatalogSnapshotConfig } from './catalogSnapshot';
import {
  defaultSourceLoaders,
  runPublishedSnapshotPipeline,
  type PublishedSnapshotPipelineResult,
  type PublishedSnapshotSourceLoaders,
} from './publishedSnapshotPipeline';
import {
  buildSupportedTermRegistry,
  supportedTermManifestPath,
  supportedTermSnapshotPath,
  writeSupportedTermRegistry,
  type SupportedTermEntry,
  type SupportedTermRegistry,
} from './supportedTermRegistry';
import {
  discoverTermWindow,
  enumerateCandidateTerms,
  type TermDescriptor,
} from './termWindow';

type FetchAdapter = typeof fetch;
type TermDateRange = CatalogSnapshot['term_date_range'];

export type MultiTermSnapshotPipelineResult = {
  registry: SupportedTermRegistry;
  metadataPath: string;
  terms: {
    descriptor: TermDescriptor;
    result: PublishedSnapshotPipelineResult;
  }[];
};

/**
 * Memoize a source loader by subject so a term-agnostic source (General
 * Catalog, Instructor Grade Archive) is fetched once per subject across the
 * whole multi-term run instead of once per term. See ADR 0012.
 */
function memoizeBySubject<C, R>(
  loader: (subject: string, context: C) => R,
): (subject: string, context: C) => R {
  const cache = new Map<string, R>();
  return (subject, context) => {
    const cached = cache.get(subject);
    if (cached !== undefined) return cached;
    const value = loader(subject, context);
    cache.set(subject, value);
    return value;
  };
}

function sharedLoaders(
  base: PublishedSnapshotSourceLoaders,
): PublishedSnapshotSourceLoaders {
  return {
    // Schedule of Classes is term-specific: fetched per term.
    scheduleOfClasses: base.scheduleOfClasses,
    // Term-agnostic sources are fetched once per subject and reused per term.
    generalCatalog: memoizeBySubject(base.generalCatalog),
    instructorGradeArchive: memoizeBySubject(base.instructorGradeArchive),
  };
}

/**
 * Generate one Published Snapshot per term in the Term Window and write a
 * single Supported Term registry to the configured metadata path.
 * Term-agnostic sources are fetched once. The set of terms is discovered by
 * probing the source unless an explicit term list is injected. See ADR 0012.
 */
export async function runMultiTermSnapshotPipeline(
  config: CatalogSnapshotConfig,
  options: {
    terms?: TermDescriptor[];
    candidateYears?: number[];
    termDateRanges?: { [term: string]: TermDateRange };
    fetch?: FetchAdapter;
    generatedAt?: string;
    runId?: string;
    sourceLoaders?: PublishedSnapshotSourceLoaders;
  } = {},
): Promise<MultiTermSnapshotPipelineResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const runId = options.runId ?? `multi-${generatedAt}-${randomUUID()}`;

  const terms =
    options.terms ??
    (await discoverTermWindow(
      enumerateCandidateTerms(
        options.candidateYears ?? defaultCandidateYears(),
      ),
      { fetch: options.fetch },
    ));

  const loaders = sharedLoaders(
    options.sourceLoaders ?? defaultSourceLoaders(),
  );

  const termResults: MultiTermSnapshotPipelineResult['terms'] = [];
  const entries: SupportedTermEntry[] = [];

  for (const descriptor of terms) {
    const perTermConfig: CatalogSnapshotConfig = {
      ...config,
      active_planning_term: descriptor.term,
      term_label: descriptor.label,
      term_date_range: resolveTermDateRange(config, descriptor.term, options),
    };

    const result = await runPublishedSnapshotPipeline(perTermConfig, {
      runId: `${runId}-${descriptor.term}`,
      generatedAt,
      fetch: options.fetch,
      sourceLoaders: loaders,
      writeMetadata: false,
    });

    termResults.push({ descriptor, result });
    entries.push({
      term: descriptor.term,
      label: descriptor.label,
      date_range: perTermConfig.term_date_range,
      frozen: false,
      generated_at: generatedAt,
      snapshot_path: supportedTermSnapshotPath(descriptor.term),
      manifest_path: supportedTermManifestPath(descriptor.term),
    });
  }

  const registry = buildSupportedTermRegistry(entries, generatedAt);
  const metadataPath = await writeSupportedTermRegistry(
    registry,
    config.paths.metadata_path,
  );

  return { registry, metadataPath, terms: termResults };
}

function resolveTermDateRange(
  config: CatalogSnapshotConfig,
  term: string,
  options: { termDateRanges?: { [term: string]: TermDateRange } },
): TermDateRange {
  const override = options.termDateRanges?.[term];
  if (override !== undefined) return override;
  // The source cannot supply term dates; only the configured term has a known
  // range. Discovered terms are null until a calendar source is wired.
  if (term === config.active_planning_term) return config.term_date_range;
  return null;
}

function defaultCandidateYears(): number[] {
  const currentYear = new Date().getUTCFullYear();
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
}
