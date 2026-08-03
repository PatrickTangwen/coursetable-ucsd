/**
 * Fetch the full course catalog for a term from the public UCSD Class Planner
 * API (https://classplanner.apps.ucsd.edu). No authentication is required.
 *
 * The Class Planner backend serves the same TSS event data that the legacy
 * OData scraper collected behind SSO login (section ids like "E 00000972"
 * match the tss_event_ids stored in published snapshots).
 *
 * Usage:
 *   bun tools/classplanner-scraper/fetch-classplanner-catalog.mts --term FA26
 *
 * Output (under --out, default data/raw/classplanner/<TERM>/<timestamp>/):
 *   terms.json    raw /api/v1/planner/terms response
 *   filters.json  raw /api/v1/catalog/filters response for the term
 *   pages/page-<offset>.json  each raw paginated /api/v1/catalog/courses response
 *   courses.json  merged course list with fetch metadata
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = 'https://classplanner.apps.ucsd.edu/api/v1';
const PAGE_LIMIT = 48; // server-enforced maximum
const REQUEST_DELAY_MS = 250;

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

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const term = argument('--term', 'FA26').toUpperCase();
const outRoot = argument('--out', 'data/raw/classplanner');
const fetchedAt = new Date().toISOString();
const runDirectory = join(outRoot, term, fetchedAt.replace(/[:.]/g, '-'));
const pagesDirectory = join(runDirectory, 'pages');
await mkdir(pagesDirectory, { recursive: true });

const terms = await fetchJson(`${BASE_URL}/planner/terms`);
await writeFile(
  join(runDirectory, 'terms.json'),
  JSON.stringify(terms, null, 2),
);

const filters = await fetchJson(
  `${BASE_URL}/catalog/filters?term_code=${term}`,
);
await writeFile(
  join(runDirectory, 'filters.json'),
  JSON.stringify(filters, null, 2),
);

type CoursesPage = {
  term_code: string;
  total: number;
  offset: number;
  courses: unknown[];
};

const courses: unknown[] = [];
let offset = 0;
let total = Number.POSITIVE_INFINITY;
while (offset < total) {
  const url = `${BASE_URL}/catalog/courses?term_code=${term}&limit=${PAGE_LIMIT}&offset=${offset}`;
  const page = (await fetchJson(url)) as CoursesPage;
  if (page.term_code !== term) {
    throw new Error(
      `term mismatch on page offset=${offset}: got ${page.term_code}`,
    );
  }
  total = page.total;
  await writeFile(
    join(pagesDirectory, `page-${String(offset).padStart(5, '0')}.json`),
    JSON.stringify(page, null, 2),
  );
  courses.push(...page.courses);
  offset += PAGE_LIMIT;
  console.log(`fetched ${Math.min(offset, total)}/${total}`);
  if (offset < total) await sleep(REQUEST_DELAY_MS);
}

if (courses.length !== total) {
  throw new Error(`expected ${total} courses, merged ${courses.length}`);
}

const merged = {
  schema_version: 'classplanner-catalog-v1',
  source: `${BASE_URL}/catalog/courses`,
  term_code: term,
  fetched_at: fetchedAt,
  total,
  courses,
};
await writeFile(
  join(runDirectory, 'courses.json'),
  JSON.stringify(merged, null, 2),
);
console.log(
  `wrote ${courses.length} courses to ${join(runDirectory, 'courses.json')}`,
);
