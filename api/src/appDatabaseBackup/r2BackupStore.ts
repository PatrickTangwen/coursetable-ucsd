import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type ListObjectsV2CommandOutput,
  type S3Client,
} from '@aws-sdk/client-s3';

import type { AppDatabaseBackupStore } from './backupStore.js';
import {
  appDatabaseBackupManifestSchema,
  manifestKeyForDump,
} from './manifest.js';
import { isKeyInsideNamespace } from './retention.js';

export function createR2AppDatabaseBackupStore(
  client: S3Client,
  bucket: string,
  namespace: string,
): AppDatabaseBackupStore {
  if (!namespace.endsWith('/'))
    throw new Error('App DB backup namespace must end in /');

  const assertDumpKey = (key: string) => {
    if (!isKeyInsideNamespace(key, namespace)) {
      throw new Error(
        'App DB backup object is outside the configured backup namespace',
      );
    }
  };

  return {
    async putDump({ key, path, metadata }) {
      assertDumpKey(key);
      const { size } = await stat(path);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(path),
          ContentLength: size,
          ContentType: 'application/vnd.postgresql.custom-dump',
          Metadata: metadata,
        }),
      );
      const stored = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (stored.ContentLength === undefined)
        throw new Error('R2 backup dump size metadata is missing');
      return {
        size: stored.ContentLength,
        metadata: stored.Metadata ?? {},
      };
    },

    async putManifest(manifest) {
      assertDumpKey(manifest.dumpKey);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: manifestKeyForDump(manifest.dumpKey),
          Body: `${JSON.stringify(manifest)}\n`,
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'no-store',
        }),
      );
    },

    async listManifests() {
      const keys: string[] = [];
      let continuationToken: string | undefined = undefined;
      do {
        const page = (await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: namespace,
            ContinuationToken: continuationToken,
          }),
        )) as unknown as ListObjectsV2CommandOutput;
        for (const object of page.Contents ?? [])
          if (object.Key?.endsWith('.manifest.json')) keys.push(object.Key);
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);

      const manifests = [];
      for (const key of keys) {
        const object = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const parsed: unknown = JSON.parse(await bodyToString(object.Body));
        const manifest = appDatabaseBackupManifestSchema.parse(parsed);
        assertDumpKey(manifest.dumpKey);
        if (manifestKeyForDump(manifest.dumpKey) !== key)
          throw new Error('R2 backup manifest key does not match its dump');
        manifests.push(manifest);
      }
      return manifests;
    },

    async downloadDump(key, destination) {
      assertDumpKey(key);
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!object.Body || object.ContentLength === undefined)
        throw new Error('R2 backup dump is incomplete');
      await pipeline(
        object.Body as NodeJS.ReadableStream,
        createWriteStream(destination),
      );
      return {
        size: object.ContentLength,
        metadata: object.Metadata ?? {},
      };
    },

    async removeBackups(manifests) {
      const objects = manifests.flatMap((manifest) => {
        assertDumpKey(manifest.dumpKey);
        return [
          { Key: manifest.dumpKey },
          { Key: manifestKeyForDump(manifest.dumpKey) },
        ];
      });
      for (let index = 0; index < objects.length; index += 1_000) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects.slice(index, index + 1_000) },
          }),
        );
      }
    },
  };
}

async function bodyToString(body: unknown) {
  if (!body) throw new Error('R2 backup manifest body is missing');
  const sdkBody = body as { transformToString?: () => Promise<string> };
  if (typeof sdkBody.transformToString === 'function')
    return sdkBody.transformToString();

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>)
    chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
