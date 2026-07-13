import { workerSecrets } from './writeWorkerSecrets.js';

const providerFailureContracts = {
  resend: {
    error: 'VERIFICATION_DELIVERY_FAILED',
    secretName: 'RESEND_API_KEY',
  },
  upstash: {
    error: 'VERIFICATION_REQUEST_UNAVAILABLE',
    secretName: 'UPSTASH_REDIS_REST_TOKEN',
  },
} as const;

export type HostedProviderFailureDrill = keyof typeof providerFailureContracts;
type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export const hostedProviderFailureDrills = Object.keys(
  providerFailureContracts,
) as HostedProviderFailureDrill[];

export function parseHostedProviderFailureDrill(value: unknown) {
  if (
    typeof value !== 'string' ||
    !hostedProviderFailureDrills.includes(value as HostedProviderFailureDrill)
  )
    throw new Error('Unexpected hosted provider failure drill');
  return value as HostedProviderFailureDrill;
}

export function providerFailureDrillSecrets(
  provider: HostedProviderFailureDrill,
  environment: { [key: string]: string | undefined },
) {
  const secrets = workerSecrets(environment);
  const { secretName } = providerFailureContracts[provider];
  return { ...secrets, [secretName]: 'invalid-hosted-failure-drill' };
}

export function expectedProviderFailureError(
  provider: HostedProviderFailureDrill,
) {
  return providerFailureContracts[provider].error;
}

export async function waitForUpstashFailureDrillConvergence(
  origin: string,
  fetcher: Fetcher = fetch,
  options: {
    attempts?: number;
    delayMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
) {
  const attempts = options.attempts ?? 10;
  const delayMs = options.delayMs ?? 2_000;
  const sleep =
    options.sleep ??
    ((durationMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, durationMs);
      }));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetcher(`${origin}/api/auth/current-user`);
    const body = (await response.json()) as {
      authenticated?: unknown;
      error?: unknown;
    };
    if (response.status === 503 && body.error === 'AUTH_UNAVAILABLE') return;
    const stillAccepted =
      response.status === 200 && body.authenticated === false;
    if (!stillAccepted)
      throw new Error('Unexpected Upstash failure-drill convergence response');
    if (attempt < attempts) await sleep(delayMs);
  }

  throw new Error('Upstash failure-drill version did not converge');
}

export function providerFailureEvidence(
  provider: HostedProviderFailureDrill,
  accountStatus: number,
  accountError: string,
  catalogStatus: number,
) {
  if (
    accountStatus !== 503 ||
    accountError !== expectedProviderFailureError(provider)
  )
    throw new Error('Hosted provider failure drill did not fail closed');
  if (catalogStatus !== 200) {
    throw new Error(
      'Hosted provider failure drill affected the public Catalog',
    );
  }
  return {
    result: 'passed' as const,
    provider,
    accountPath: 'failed-closed' as const,
    catalog: 'available' as const,
  };
}
