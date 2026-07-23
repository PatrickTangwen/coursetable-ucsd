import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  publishAcceptedCatalog,
  type CatalogPublicationStore,
} from '../src/catalogPublication.js';

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(import.meta.dirname, '../..');
const configPath = path.join(rootDirectory, 'worker/wrangler.jsonc');
const wranglerPath = path.join(rootDirectory, 'node_modules/.bin/wrangler');
const bucketName = 'sungrid-staging-catalog';
const encoder = new TextEncoder();

class LocalWranglerPublicationStore implements CatalogPublicationStore {
  #objectNumber = 0;
  readonly #objectDirectory: string;
  readonly #persistenceDirectory: string;

  constructor(objectsPath: string, persistencePath: string) {
    this.#objectDirectory = objectsPath;
    this.#persistenceDirectory = persistencePath;
  }

  async putObject(
    key: string,
    body: Uint8Array,
    options: {
      contentType: string;
      cacheControl: string;
      customMetadata: { [key: string]: string };
    },
  ) {
    const filename = path.join(
      this.#objectDirectory,
      `${String(this.#objectNumber++).padStart(2, '0')}.json`,
    );
    await writeFile(filename, body);
    await execFileAsync(
      wranglerPath,
      [
        'r2',
        'object',
        'put',
        `${bucketName}/${key}`,
        '--local',
        '--persist-to',
        this.#persistenceDirectory,
        '--config',
        configPath,
        '--file',
        filename,
        '--content-type',
        options.contentType,
        '--cache-control',
        options.cacheControl,
        '--force',
      ],
      { cwd: rootDirectory },
    );
  }
}

const tempDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'sungrid-worker-catalog-'),
);
const persistenceDirectory = path.join(tempDirectory, 'state');
const objectDirectory = path.join(tempDirectory, 'objects');
await mkdir(objectDirectory, { recursive: true });

let worker: ChildProcess | null = null;
try {
  const snapshot = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      run_id: 'local-worker-validation',
      generated_at: '2026-07-11T00:00:00.000Z',
      courses: [
        {
          course_id: 'CSE:100',
          title: 'Advanced Data Structures',
          grade_archive_records: [{ year: '2025', quarter: 'FA' }],
        },
      ],
    }),
  );
  const manifest = encoder.encode(
    JSON.stringify({
      active_planning_term: 'FA26',
      generated_at: '2026-07-11T00:00:00.000Z',
      summary: { ok: 3, empty: 0, failed: 0, partial: 0 },
      cells: [
        { term: 'FA26', source: 'schedule_of_classes', status: 'ok' },
        { term: 'FA26', source: 'general_catalog', status: 'ok' },
        {
          term: 'FA26',
          source: 'instructor_grade_archive',
          status: 'ok',
        },
      ],
    }),
  );
  const registry = encoder.encode(
    JSON.stringify({
      last_update: '2026-07-11T00:00:00.000Z',
      terms: [
        {
          term: 'FA26',
          label: 'Fall 2026',
          date_range: { start: '2026-09-24', end: '2026-12-12' },
          frozen: false,
          generated_at: '2026-07-11T00:00:00.000Z',
          snapshot_path: 'catalogs/public/FA26.json',
          manifest_path: 'catalogs/import-manifests/FA26.json',
        },
      ],
    }),
  );
  const publication = await publishAcceptedCatalog(
    {
      accepted: true,
      term: 'FA26',
      snapshot: artifact(snapshot),
      manifest: artifact(manifest),
      registry,
    },
    new LocalWranglerPublicationStore(objectDirectory, persistenceDirectory),
  );

  const port = await unusedPort();
  worker = spawn(
    wranglerPath,
    [
      'dev',
      '--config',
      configPath,
      '--local',
      '--persist-to',
      persistenceDirectory,
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--log-level',
      'error',
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_APP_DB_HYPERDRIVE_NO_CACHE:
          'postgresql://user:password@catalog-validation.invalid:5432/app',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const output: string[] = [];
  worker.stdout?.on('data', (chunk: Uint8Array) =>
    output.push(Buffer.from(chunk).toString('utf8')),
  );
  worker.stderr?.on('data', (chunk: Uint8Array) =>
    output.push(Buffer.from(chunk).toString('utf8')),
  );

  const origin = `http://127.0.0.1:${port}`;
  await waitUntilReady(origin, worker, output);

  const root = await fetch(origin);
  assert(root.status === 200, 'React asset root did not return 200');
  assert(
    root.headers.get('content-type')?.includes('text/html') === true,
    'React asset root did not return HTML',
  );

  const metadata = await fetch(`${origin}/api/catalog/metadata`);
  assert(metadata.status === 200, 'Catalog metadata did not return 200');
  assertJson(metadata, 'Catalog metadata');
  const snapshotResponse = await fetch(`${origin}/api/catalog/public/FA26`);
  assert(
    snapshotResponse.status === 200,
    'Published Snapshot did not return 200',
  );
  assertJson(snapshotResponse, 'Published Snapshot');
  assert(
    snapshotResponse.headers.get('cache-control') === 'public, max-age=3600',
    'Published Snapshot cache control changed',
  );
  const etag = snapshotResponse.headers.get('etag');
  assert(etag !== null, 'Published Snapshot did not return an ETag');
  const snapshotBody: unknown = await snapshotResponse.json();
  assert(
    snapshotBody !== null &&
      typeof snapshotBody === 'object' &&
      !Array.isArray(snapshotBody) &&
      (snapshotBody as { active_planning_term?: unknown })
        .active_planning_term === 'FA26',
    'Published Snapshot returned the wrong term',
  );
  assert(
    JSON.stringify(snapshotBody).includes('grade_archive_records') === false,
    'Published Snapshot list exposed grade archive records',
  );
  const detailResponse = await fetch(`${origin}/api/catalog/details/FA26`);
  assert(detailResponse.status === 200, 'Catalog details did not return 200');
  assertJson(detailResponse, 'Catalog details');
  const detailBody: unknown = await detailResponse.json();
  assert(
    detailBody !== null &&
      typeof detailBody === 'object' &&
      !Array.isArray(detailBody) &&
      JSON.stringify(detailBody).includes('grade_archive_records'),
    'Catalog details did not contain grade archive records',
  );
  const notModified = await fetch(`${origin}/api/catalog/public/FA26`, {
    headers: { 'if-none-match': etag },
  });
  assert(notModified.status === 304, 'Published Snapshot ETag was not honored');

  for (const pathname of [
    '/api/catalog/public/NOPE',
    '/api/catalog/refresh',
    '/api/sitemaps/index.xml',
    '/ferry/v1/graphql',
  ]) {
    const response = await fetch(`${origin}${pathname}`);
    assert(response.status === 404, `${pathname} was unexpectedly public`);
    const text = await response.text();
    assert(
      !text.includes('r2.dev') && !text.includes('workers.dev'),
      `${pathname} exposed a provider-default URL`,
    );
  }

  console.log(
    JSON.stringify({
      result: 'passed',
      surface: 'local Worker single origin',
      term: 'FA26',
      snapshotKey: publication.snapshotKey,
      detailKey: publication.detailKey,
      manifestKey: publication.manifestKey,
      providerResourcesCreated: false,
    }),
  );
} finally {
  if (worker) await stopWorker(worker);
  await rm(tempDirectory, { recursive: true, force: true });
}

function artifact(body: Uint8Array) {
  return {
    body,
    size: body.byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}

function unusedPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a Worker validation port'));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitUntilReady(
  origin: string,
  child: ChildProcess,
  output: string[],
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Local Worker exited early: ${output.join('').slice(-2000)}`,
      );
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The local listener is not ready yet.
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 250);
    });
  }
  throw new Error(
    `Local Worker did not become ready: ${output.join('').slice(-2000)}`,
  );
}

async function stopWorker(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
    }),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
        resolve();
      }, 5_000);
    }),
  ]);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertJson(response: Response, label: string) {
  assert(
    response.headers.get('content-type')?.startsWith('application/json') ===
      true,
    `${label} did not return JSON`,
  );
}
