import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { TermArchiveStore } from './catalogPublisher.js';
import { stagingContract } from './stagingContract.js';

export function createR2CatalogStore(
  environment: { [key: string]: string | undefined } = process.env,
) {
  const accountId = required(environment, 'CLOUDFLARE_ACCOUNT_ID');
  const bucket = required(environment, 'R2_CATALOG_BUCKET');
  if (bucket !== stagingContract.bucket)
    throw new Error('Unexpected staging Catalog bucket');
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
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const body = await result.Body?.transformToByteArray();
        return body ? Uint8Array.from(body) : null;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async put(key, body, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          CacheControl: options.cacheControl,
          ContentType: options.contentType,
          Metadata: options.metadata,
          StorageClass: options.storageClass,
        }),
      );
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
  return store;
}

function required(
  environment: { [key: string]: string | undefined },
  name: string,
) {
  const value = environment[name];
  if (!value) throw new Error(`Missing staging deployment input: ${name}`);
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
