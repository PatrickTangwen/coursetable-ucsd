// Rollback-proof evidence for issue #116: records deployment identity and
// non-sensitive outcomes after test-migrate.sh has proven that the current
// and the previous (pre-#114) Worker revisions both operate against the
// forward-compatible App DB schema. Runs only after every proof step passed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { assertGeneralTelemetrySafe } from '../src/telemetry/privacy.js';

const [, , previousWorkerRef] = process.argv;
assert.ok(previousWorkerRef, 'Previous Worker ref argument is required');

// Short commits stay under the telemetry scrubber's long-hex redaction
// threshold while still identifying both deployments.
const shortCommit = (ref: string) =>
  execFileSync('git', ['rev-parse', '--short=12', ref], {
    encoding: 'utf8',
  }).trim();

const journal = JSON.parse(
  await readFile(
    new URL('./migrations/meta/_journal.json', import.meta.url),
    'utf8',
  ),
) as { entries: { tag: string }[] };
const schemaVersion = journal.entries.at(-1)?.tag;
assert.ok(schemaVersion, 'No committed schema version');

const evidence = {
  result: 'passed',
  surface: 'Worker rollback against the forward-compatible App DB schema',
  deployment: {
    gitCommit: shortCommit('HEAD'),
    previousWorkerCommit: shortCommit(previousWorkerRef),
    schemaVersion,
  },
  outcomes: {
    freshMigration: 'applied',
    repeatedMigration: 'no-op',
    currentWorkerContract: 'passed',
    previousWorkerContract: 'passed',
  },
  providerResourcesCreated: false,
};

assertGeneralTelemetrySafe(evidence);
console.log(JSON.stringify(evidence));
