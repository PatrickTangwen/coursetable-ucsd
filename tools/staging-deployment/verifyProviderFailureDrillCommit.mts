import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { acceptedGitCommit, lastAcceptedFilename } from './lastAccepted.js';

const selectedCommit = process.env.DEPLOY_COMMIT;
if (!selectedCommit || !/^[a-f\d]{40}$/u.test(selectedCommit))
  throw new Error('Hosted provider failure drill commit is invalid');
const artifactDirectory = path.resolve(
  import.meta.dirname,
  '../../artifacts/staging-deployment',
);
const acceptedCommit = acceptedGitCommit(
  await readFile(path.join(artifactDirectory, lastAcceptedFilename)),
);
if (selectedCommit !== acceptedCommit)
  throw new Error('Hosted provider failure drill commit is not accepted');
console.log(JSON.stringify({ result: 'matched-accepted-commit' }));
