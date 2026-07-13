import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deploymentArtifactDirectory,
  deploymentContract,
} from './deploymentContext.js';
import { runHostedDeploymentSmoke } from './smokeHostedStaging.js';

const root = path.resolve(import.meta.dirname, '../..');
const contract = deploymentContract();
const evidence = await runHostedDeploymentSmoke(
  `https://${contract.hostname}`,
  contract,
);
const artifactDirectory = deploymentArtifactDirectory(root, contract);
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  path.join(artifactDirectory, 'hosted-smoke.json'),
  `${JSON.stringify(evidence)}\n`,
);
console.log(JSON.stringify(evidence));
