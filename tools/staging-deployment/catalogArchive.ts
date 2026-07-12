import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

type Artifact = {
  body: Uint8Array;
  path: string;
  sha256: string;
  size: number;
};

type RegistryEntry = {
  term: string;
  label: string;
  date_range: { start: string; end: string } | null;
  frozen: boolean;
  generated_at: string;
  snapshot_path: string;
  manifest_path: string;
};

const defaultRoot = path.resolve(process.cwd());
const decoder = new TextDecoder();

export async function buildCatalogArchive(root = defaultRoot) {
  const staticDirectory = path.join(root, 'api/static');
  const snapshotDirectory = path.join(staticDirectory, 'catalogs/public');
  const manifestDirectory = path.join(
    staticDirectory,
    'catalogs/import-manifests',
  );
  const metadata = parseObject(
    'Catalog metadata',
    await readFile(path.join(staticDirectory, 'metadata.json')),
  );
  if (typeof metadata.last_update !== 'string')
    throw new Error('Catalog metadata last_update is invalid');

  const snapshotTerms = await jsonTerms(snapshotDirectory);
  const manifestTerms = await jsonTerms(manifestDirectory);
  if (snapshotTerms.join('\n') !== manifestTerms.join('\n'))
    throw new Error('Published Snapshot and Import Manifest terms differ');

  const priorFrozen = new Map(
    Array.isArray(metadata.terms)
      ? metadata.terms.flatMap((entry) =>
          isObject(entry) &&
          typeof entry.term === 'string' &&
          typeof entry.frozen === 'boolean'
            ? [[entry.term, entry.frozen] as const]
            : [],
        )
      : [],
  );

  const terms = await Promise.all(
    snapshotTerms.map(async (term) => {
      const snapshot = await artifact(
        path.join(snapshotDirectory, `${term}.json`),
        root,
      );
      const manifest = await artifact(
        path.join(manifestDirectory, `${term}.json`),
        root,
      );
      const snapshotJson = parseObject('Published Snapshot', snapshot.body);
      const manifestJson = parseObject('Import Manifest', manifest.body);
      assertTerm('Published Snapshot', snapshotJson, term);
      assertTerm('Import Manifest', manifestJson, term);
      assertAcceptedManifest(manifestJson, term);
      if (
        typeof snapshotJson.term_label !== 'string' ||
        typeof snapshotJson.generated_at !== 'string'
      )
        throw new Error(`Published Snapshot identity is invalid for ${term}`);

      return {
        term,
        label: snapshotJson.term_label,
        dateRange: parseDateRange(snapshotJson.term_date_range, term),
        frozen: priorFrozen.get(term) ?? false,
        generatedAt: snapshotJson.generated_at,
        snapshot,
        manifest,
      };
    }),
  );
  terms.sort((left, right) =>
    (left.dateRange?.start ?? left.term).localeCompare(
      right.dateRange?.start ?? right.term,
    ),
  );

  const registry = {
    last_update: metadata.last_update,
    terms: terms.map(
      ({
        term,
        label,
        dateRange,
        frozen,
        generatedAt,
        snapshot,
        manifest,
      }) => ({
        term,
        label,
        date_range: dateRange,
        frozen,
        generated_at: generatedAt,
        snapshot_path: `published-snapshots/${term}/${snapshot.sha256}.json`,
        manifest_path: `published-manifests/${term}/${manifest.sha256}.json`,
      }),
    ) satisfies RegistryEntry[],
  };

  return { registry, terms };
}

async function jsonTerms(directory: string) {
  return (await readdir(directory))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

async function artifact(filename: string, root: string): Promise<Artifact> {
  const body = await readFile(filename);
  return {
    body,
    path: path.relative(root, filename),
    sha256: createHash('sha256').update(body).digest('hex'),
    size: body.byteLength,
  };
}

function parseObject(label: string, body: Uint8Array) {
  const parsed: unknown = JSON.parse(decoder.decode(body));
  if (!isObject(parsed)) throw new Error(`${label} is not a JSON object`);
  return parsed;
}

function assertTerm(
  label: string,
  value: { [key: string]: unknown },
  term: string,
) {
  if (value.active_planning_term !== term)
    throw new Error(`${label} term mismatch for ${term}`);
}

function assertAcceptedManifest(
  manifest: { [key: string]: unknown },
  term: string,
) {
  if (!Array.isArray(manifest.cells) || !isObject(manifest.summary))
    throw new Error(`Import Manifest is invalid for ${term}`);
  const statuses = ['ok', 'empty', 'failed', 'partial'] as const;
  for (const status of statuses) {
    const actual = manifest.cells.filter(
      (cell) => isObject(cell) && cell.status === status && cell.term === term,
    ).length;
    if (manifest.summary[status] !== actual)
      throw new Error(`Import Manifest summary is invalid for ${term}`);
  }
  if (
    manifest.cells.some(
      (cell) =>
        !isObject(cell) ||
        cell.term !== term ||
        !statuses.includes(cell.status as (typeof statuses)[number]),
    )
  )
    throw new Error(`Import Manifest cells are invalid for ${term}`);
}

function parseDateRange(value: unknown, term: string) {
  if (value === null) return null;
  if (
    !isObject(value) ||
    typeof value.start !== 'string' ||
    typeof value.end !== 'string'
  )
    throw new Error(`Published Snapshot date range is invalid for ${term}`);
  return { start: value.start, end: value.end };
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
