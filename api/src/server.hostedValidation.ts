import {
  createCaptureVerificationEmailSender,
  hostedValidationCaptureDirectory,
} from './auth/verificationEmail.capture.js';
import { installHostedValidationSender } from './auth/verificationEmail.runtime.js';

installHostedValidationSender(
  createCaptureVerificationEmailSender(hostedValidationCaptureDirectory),
);

await import('./server.js');
