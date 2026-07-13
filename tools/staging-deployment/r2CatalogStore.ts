import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { HostedDeploymentContract } from './productionContract.js';
import { stagingContract } from './stagingContract.js';
import type { TermArchiveStore } from './termArchivePublisher.js';

const r2RequestTimeoutMs = 20_000;

export async function withR2RequestTimeout<T>(
  operation: string,
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = r2RequestTimeoutMs,
) {
  try {
    return await request(AbortSignal.timeout(timeoutMs));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    )
      throw new Error(`R2 ${operation} timed out`, { cause: error });
    throw error;
  }
}

export function createR2CatalogStore(
  environment: { [key: string]: string | undefined } = process.env,
  contract: HostedDeploymentContract = stagingContract,
) {
  const accountId = required(environment, 'CLOUDFLARE_ACCOUNT_ID');
  const bucket = required(environment, 'R2_CATALOG_BUCKET');
  if (bucket !== contract.bucket)
    throw new Error(`Unexpected ${contract.target} Catalog bucket`);
  const client = new S3Client({
    credentials: {
      accessKeyId: required(environment, 'R2_CATALOG_ACCESS_KEY_ID'),
      secretAccessKey: required(environment, 'R2_CATALOG_SECRET_ACCESS_KEY'),
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
  });

  const store: TermArchiveStore = {
    async get(key) {
      try {
        return await withR2RequestTimeout(`GET ${key}`, async (abortSignal) => {
          const result = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { abortSignal },
          );
          const body = await result.Body?.transformToByteArray();
          return body ? Uint8Array.from(body) : null;
        });
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async put(key, body, options) {
      await withR2RequestTimeout(`PUT ${key}`, (abortSignal) =>
        client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            CacheControl: options.cacheControl,
            ContentType: options.contentType,
            Metadata: options.metadata,
            StorageClass: options.storageClass,
          }),
          { abortSignal },
        ),
      );
    },
    async delete(key) {
      await withR2RequestTimeout(`DELETE ${key}`, (abortSignal) =>
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
          abortSignal,
        }),
      );
    },
  };
  return store;
}

function required(
  environment: { [key: string]: string | undefined },
  name: string,
) {
  const value = environment[name];
  if (!value) throw new Error(`Missing hosted deployment input: ${name}`);
  return value;
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
