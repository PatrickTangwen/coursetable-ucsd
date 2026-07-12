import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function inspectStaticAssets(directory: string, limit: number) {
  const files = await listFiles(directory);
  if (files.length > limit) {
    throw new Error(
      `Static asset count ${files.length} exceeds Workers Free limit ${limit}`,
    );
  }
  const identity = createHash('sha256');
  for (const filename of files) {
    const relative = path
      .relative(directory, filename)
      .replaceAll(path.sep, '/');
    const fileDigest = createHash('sha256')
      .update(await readFile(filename))
      .digest('hex');
    identity.update(`${relative}\0${fileDigest}\n`);
  }
  return { fileCount: files.length, buildDigest: identity.digest('hex') };
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(filename)));
    else files.push(filename);
  }
  return files.sort();
}
