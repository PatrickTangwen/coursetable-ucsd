import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { verifyRestoredAppDatabase } from './restoreVerifier.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

describe('restored App DB verifier', () => {
  it.skipIf(!process.env.APP_DB_RESTORE_TEST_URL)(
    'checks the schema version and reads every key table without returning row data',
    async () => {
      const databaseUrl = process.env.APP_DB_RESTORE_TEST_URL!;
      const client = postgres(databaseUrl, { max: 1 });
      try {
        await client`
          insert into "appUsers" ("verifiedEmail", "createdAt", "updatedAt")
          values ('private-student@ucsd.edu', 1, 1)
        `;
      } finally {
        await client.end();
      }

      const evidence = await verifyRestoredAppDatabase(
        databaseUrl,
        '0002_wild_skaar',
      );

      expect(evidence).toEqual({
        keyTables: [
          'appUsers',
          'emailVerificationCodes',
          'emailDeliveryAudits',
          'savedSearches',
          'savedWorksheets',
          'savedWorksheetSections',
        ],
        schemaVersion: '0002_wild_skaar',
      });
      expect(JSON.stringify(evidence)).not.toContain(
        'private-student@ucsd.edu',
      );
      expect(() => assertGeneralTelemetrySafe(evidence)).not.toThrow();
    },
  );
});
