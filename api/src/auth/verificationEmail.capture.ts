import crypto from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { VerificationEmailSender } from './verificationEmail.sender.js';

export const hostedValidationCaptureDirectory =
  '/tmp/coursetable-verification-capture';

export function captureFilename(recipient: string) {
  return `${crypto.createHash('sha256').update(recipient).digest('hex')}.json`;
}

export function createCaptureVerificationEmailSender(
  captureDirectory: string,
): VerificationEmailSender {
  if (!path.isAbsolute(captureDirectory))
    throw new Error('Verification email capture directory must be absolute');

  return {
    async sendVerificationEmail(message) {
      await mkdir(captureDirectory, { recursive: true, mode: 0o700 });
      const filename = captureFilename(message.recipient);
      const target = path.join(captureDirectory, filename);
      const temporary = `${target}.${process.pid}.tmp`;
      try {
        await writeFile(
          temporary,
          `${JSON.stringify({
            code: extractCode(message.text),
            deliveryId: message.deliveryId,
            recipient: message.recipient,
          })}\n`,
          { mode: 0o600 },
        );
        await rename(temporary, target);
      } catch (error) {
        await Promise.all([
          rm(temporary, { force: true }),
          rm(target, { force: true, recursive: true }),
        ]);
        throw error;
      }
    },
  };
}

function extractCode(text: string) {
  const code = /\b\d{6}\b/u.exec(text)?.[0];
  if (!code) throw new Error('Verification email did not contain a code');
  return code;
}
