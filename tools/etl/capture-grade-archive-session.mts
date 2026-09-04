/**
 * Captures the operator's UCSD Single Sign-On session for the Instructor
 * Grade Archive without tooling ever seeing the password or second factor.
 *
 * Opens a visible Google Chrome window (fresh profile) on the archive page.
 * The operator signs in there. Once the archive's search form is served from
 * qa-as.ucsd.edu, the browser's cookies for that host are written as one
 * `Cookie` header line to the session file, and one authenticated archive
 * query proves the file works. Re-run whenever the session expires.
 *
 * Usage:
 *   bun tools/etl/capture-grade-archive-session.mts
 *     [--grade-archive-session <file>] [--timeout-minutes 10]
 */

import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
import { defaultInstructorGradeArchiveSessionPath } from './gradeArchiveSession.js';
import {
  fetchInstructorGradeArchiveForSubject,
  withInstructorGradeArchiveSession,
} from '../catalog-snapshot/instructorGradeArchive.js';

const archiveUrl = 'https://qa-as.ucsd.edu/Home/InstructorGradeArchive';

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function describeExpiry(expires: number): string {
  if (expires < 0) return 'browser session';
  return new Date(expires * 1000).toISOString();
}

const sessionPath = argument(
  '--grade-archive-session',
  defaultInstructorGradeArchiveSessionPath,
);
const timeoutMs = Number(argument('--timeout-minutes', '10')) * 60_000;

const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(archiveUrl);
  console.log(
    'Sign in to UCSD Single Sign-On in the Chrome window that just opened.',
  );
  console.log(
    `Waiting up to ${timeoutMs / 60_000} minutes for the archive page to load...`,
  );
  await page.waitForURL((url) => url.host === new URL(archiveUrl).host, {
    timeout: timeoutMs,
  });
  await page.waitForSelector('form[action*="InstructorGradeArchive"]', {
    timeout: timeoutMs,
  });

  const cookies = await context.cookies(archiveUrl);
  if (!cookies.length) throw new Error('No cookies were set for the archive');
  for (const cookie of cookies) {
    console.log(
      `  ${cookie.name}: httpOnly=${String(cookie.httpOnly)} expires=${describeExpiry(cookie.expires)}`,
    );
  }
  const header = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  await mkdir(dirname(sessionPath), { recursive: true });
  await writeFile(sessionPath, `${header}\n`, { mode: 0o600 });
  await chmod(sessionPath, 0o600);
  console.log(`Wrote ${cookies.length} cookies to ${sessionPath}`);

  const records = await fetchInstructorGradeArchiveForSubject('CSE', {
    fetch: withInstructorGradeArchiveSession(header),
  });
  console.log(
    `Instructor Grade Archive session OK: ${records.length} CSE rows outside the browser`,
  );
  console.log(
    'The session lasts about two hours. Refresh the archive now with:\n' +
      '  bun run etl:refresh:grades',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
