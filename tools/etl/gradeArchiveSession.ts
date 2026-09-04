/**
 * Operator-supplied UCSD Single Sign-On session for the Instructor Grade
 * Archive (see docs/etl_refresh.md, "Instructor Grade Archive session").
 *
 * The file holds one line: the browser's `Cookie` request-header value for
 * qa-as.ucsd.edu. It lives outside the repository, next to the scheduled
 * refresh worktree, so it is never committed and survives worktree resets.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const defaultInstructorGradeArchiveSessionPath = join(
  homedir(),
  '.coursetable-etl',
  'grade-archive-session',
);

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Returns the cookie header value, or null when no session file exists. */
export async function loadInstructorGradeArchiveSession(
  path: string,
): Promise<string | null> {
  const contents = await readIfExists(path);
  if (contents === null) return null;
  const cookie = contents.trim();
  if (!cookie)
    throw new Error(`Instructor Grade Archive session file is empty: ${path}`);

  if (/[\r\n]/u.test(cookie)) {
    throw new Error(
      `Instructor Grade Archive session file must hold a single Cookie header line: ${path}`,
    );
  }
  return cookie;
}
