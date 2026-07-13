import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deploymentArtifactDirectory,
  deploymentContract,
} from './deploymentContext.js';
import { acceptedGitCommit, lastAcceptedFilename } from './lastAccepted.js';

const selectedCommit = process.env.DEPLOY_COMMIT;
if (!selectedCommit || !/^[a-f\d]{40}$/u.test(selectedCommit))
  throw new Error('Hosted provider failure drill commit is invalid');
const contract = deploymentContract();
const root = path.resolve(import.meta.dirname, '../..');
const artifactDirectory = deploymentArtifactDirectory(root, contract);
const acceptedCommit = acceptedGitCommit(
  await readFile(path.join(artifactDirectory, lastAcceptedFilename)),
  contract,
);
if (selectedCommit !== acceptedCommit)
  throw new Error('Hosted provider failure drill commit is not accepted');
console.log(JSON.stringify({ result: 'matched-accepted-commit' }));
