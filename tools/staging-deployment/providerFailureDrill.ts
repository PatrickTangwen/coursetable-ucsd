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
