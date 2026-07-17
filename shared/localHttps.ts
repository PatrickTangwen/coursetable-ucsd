import fs from 'node:fs';
import path from 'node:path';

export function readLocalHttpsCredentials(certificateDirectory: string) {
  const keyPath = path.join(certificateDirectory, 'localhost-key.pem');
  const certificatePath = path.join(certificateDirectory, 'localhost-cert.pem');

  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certificatePath),
    };
  } catch (error) {
    throw new Error(
      `Local HTTPS certificates are missing from ${certificateDirectory}. Run \`bun run local:https:setup\` from the repository root.`,
      { cause: error },
    );
  }
}
