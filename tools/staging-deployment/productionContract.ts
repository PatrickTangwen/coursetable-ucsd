import { stagingContract } from './stagingContract.js';

type Environment = { [key: string]: string | undefined };

export type HostedDeploymentContract = {
  target: 'staging' | 'production';
  artifactDirectory: string;
  bucket: string;
  hostname: string;
  lastAcceptedKey: string;
  publicLoginEnabled: boolean;
  senderDomain: string;
  worker: string;
  freeLimits: typeof stagingContract.freeLimits;
};

export function createProductionContract(
  environment: Environment,
): HostedDeploymentContract {
  if (environment.DEPLOYMENT_TARGET !== 'production')
    throw new Error('DEPLOYMENT_TARGET must be production');

  const hostname = required(environment, 'CLOUDFLARE_PRODUCTION_HOSTNAME');
  const worker = required(environment, 'CLOUDFLARE_WORKER_NAME');
  const bucket = required(environment, 'R2_CATALOG_BUCKET');
  const senderDomain = required(
    environment,
    'VERIFICATION_EMAIL_SENDER_DOMAIN',
  );
  const isolationVerifiedAt = required(
    environment,
    'PRODUCTION_ISOLATION_VERIFIED_AT',
  );

  if (
    hostname === stagingContract.hostname ||
    worker === stagingContract.worker ||
    bucket === stagingContract.bucket
  )
    throw new Error('Production deployment must not reuse Staging identity');

  if (
    !isHostname(hostname) ||
    /(?:workers|r2)\.dev$/u.test(hostname) ||
    !isHostname(senderDomain)
  )
    throw new Error('Production deployment hostname is invalid');

  if (
    !/^sungrid-[a-z\d-]+$/u.test(worker) ||
    !/^sungrid-[a-z\d-]+$/u.test(bucket)
  )
    throw new Error('Production deployment resource name is invalid');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      isolationVerifiedAt,
    )
  )
    throw new Error('PRODUCTION_ISOLATION_VERIFIED_AT must be a UTC timestamp');

  const publicLoginEnabled = environment.PUBLIC_LOGIN_ENABLED === 'true';
  if (
    publicLoginEnabled &&
    environment.PRODUCTION_LOGIN_TOGGLE_AUTHORIZED !== 'true'
  )
    throw new Error('Production public login toggle is not authorized');

  return {
    target: 'production',
    artifactDirectory: 'production-deployment',
    bucket,
    hostname,
    lastAcceptedKey: stagingContract.lastAcceptedKey,
    publicLoginEnabled,
    senderDomain,
    worker,
    freeLimits: stagingContract.freeLimits,
  };
}

function required(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing Production deployment input: ${name}`);
  return value;
}

function isHostname(value: string) {
  return (
    value.length <= 253 &&
    value
      .split('.')
      .every((label) => /^(?!-)[a-z\d-]{1,63}(?<!-)$/u.test(label))
  );
}
