import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  captureFilename,
  createCaptureVerificationEmailSender,
} from './verificationEmail.capture.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('verification email capture sender', () => {
  it('captures a test message under a recipient digest', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'email-capture-'));
    temporaryDirectories.push(directory);
    const sender = createCaptureVerificationEmailSender(directory);

    await sender.sendVerificationEmail({
      deliveryId: 'verification/1/2',
      recipient: 'student@ucsd.edu',
      requestedAt: 1_000_000,
      subject: 'subject',
      text: 'Your verification code is 123456.',
      html: '<p>123456</p>',
    });

    const captured = JSON.parse(
      await readFile(
        path.join(directory, captureFilename('student@ucsd.edu')),
        'utf8',
      ),
    ) as unknown;
    expect(captured).toEqual({
      code: '123456',
      deliveryId: 'verification/1/2',
      recipient: 'student@ucsd.edu',
    });
    expect(captureFilename('student@ucsd.edu')).not.toContain('student');
  });

  it('requires an absolute capture directory', () => {
    expect(() => createCaptureVerificationEmailSender('relative')).toThrow(
      'capture directory must be absolute',
    );
  });

  it('removes temporary capture state when message creation fails', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'email-capture-'));
    temporaryDirectories.push(directory);
    const sender = createCaptureVerificationEmailSender(directory);

    await expect(
      sender.sendVerificationEmail({
        deliveryId: 'verification/1/2',
        recipient: 'student@ucsd.edu',
        requestedAt: 1_000_000,
        subject: 'subject',
        text: 'message without a verification value',
        html: '<p>missing</p>',
      }),
    ).rejects.toThrow('did not contain a code');

    await expect(
      readFile(
        path.join(directory, captureFilename('student@ucsd.edu')),
        'utf8',
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
