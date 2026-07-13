import { describe, expect, it } from 'vitest';

import {
  appDatabaseBackupFailureEvidence,
  appDatabaseBackupStages,
} from './failureEvidence.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

describe('App DB backup failure evidence', () => {
  it.each(appDatabaseBackupStages)(
    'reports only the fixed %s stage',
    (stage) => {
      const evidence = appDatabaseBackupFailureEvidence(stage);

      expect(evidence).toEqual({ result: 'failure', stage });
      expect(() => assertGeneralTelemetrySafe(evidence)).not.toThrow();
    },
  );
});
