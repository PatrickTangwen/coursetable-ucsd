import path from 'node:path';

import {
  createProductionContract,
  type HostedDeploymentContract,
} from './productionContract.js';
import { stagingContract } from './stagingContract.js';

export function deploymentContract(
  environment: { [key: string]: string | undefined } = process.env,
): HostedDeploymentContract {
  const target = environment.DEPLOYMENT_TARGET ?? 'staging';
  if (target === 'staging') return stagingContract;
  if (target === 'production') return createProductionContract(environment);
  throw new Error('DEPLOYMENT_TARGET must be staging or production');
}

export function deploymentArtifactDirectory(
  root: string,
  contract: HostedDeploymentContract,
) {
  return path.join(root, 'artifacts', contract.artifactDirectory);
}

export function generatedWranglerPath(
  root: string,
  contract: HostedDeploymentContract,
) {
  return path.join(root, `worker/wrangler.${contract.target}.generated.jsonc`);
}
