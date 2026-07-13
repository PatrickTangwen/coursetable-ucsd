import {
  parseHostedProviderFailureDrill,
  providerFailureEvidence,
} from './providerFailureDrill.js';
import { stagingContract } from './stagingContract.js';

const provider = parseHostedProviderFailureDrill(
  process.env.PROVIDER_FAILURE_DRILL,
);
if (process.env.CLOUDFLARE_STAGING_HOSTNAME !== stagingContract.hostname)
  throw new Error('Unexpected hosted provider failure drill hostname');

const origin = `https://${stagingContract.hostname}`;
const syntheticAddress = `failure-drill-${crypto.randomUUID()}@${[
  'ucsd',
  'edu',
].join('.')}`;
const accountResponse = await fetch(
  `${origin}/api/auth/ucsd/request-verification`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: syntheticAddress }),
  },
);
const accountBody = (await accountResponse.json()) as { error?: unknown };
const catalogResponse = await fetch(`${origin}/api/catalog/metadata`);
const evidence = providerFailureEvidence(
  provider,
  accountResponse.status,
  typeof accountBody.error === 'string' ? accountBody.error : '',
  catalogResponse.status,
);
console.log(JSON.stringify(evidence));
