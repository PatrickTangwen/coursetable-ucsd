import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { verifyFreeBoundary } from './verifyFreeBoundary.js';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing staging deployment input: ${name}`);
  return value;
};
const artifactDirectory = path.resolve(
  import.meta.dirname,
  '../../artifacts/staging-deployment',
);
const publication = JSON.parse(
  await readFile(
    path.join(artifactDirectory, 'catalog-publication.json'),
    'utf8',
  ),
) as { terms?: unknown[] };
if (!Array.isArray(publication.terms))
  throw new Error('Term Archive publication evidence is invalid');
const evidence = await verifyFreeBoundary({
  accountId: required('CLOUDFLARE_ACCOUNT_ID'),
  apiToken: required('CLOUDFLARE_API_TOKEN'),
  bucket: required('R2_CATALOG_BUCKET'),
  hostname: required('CLOUDFLARE_STAGING_HOSTNAME'),
  hyperdriveId: required('HYPERDRIVE_CONFIG_ID'),
  publishedObjectReadbacks: publication.terms.length * 2 + 1,
  worker: required('CLOUDFLARE_WORKER_NAME'),
});
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  path.join(artifactDirectory, 'free-boundary.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));
