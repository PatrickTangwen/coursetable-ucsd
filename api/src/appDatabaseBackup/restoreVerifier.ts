import postgres from 'postgres';

import { readAppDatabaseSchemaVersion } from '../../drizzle/migrationRunner.js';
import { assertGeneralTelemetrySafe } from '../telemetry/privacy.js';

const keyTables = [
  'appUsers',
  'emailVerificationCodes',
  'emailDeliveryAudits',
  'savedSearches',
  'savedWorksheets',
  'savedWorksheetSections',
] as const;

export async function verifyRestoredAppDatabase(
  databaseUrl: string,
  expectedSchemaVersion: string,
) {
  const client = postgres(databaseUrl, { max: 1, onnotice() {} });
  try {
    const schemaVersion = await readAppDatabaseSchemaVersion(client);
    if (schemaVersion !== expectedSchemaVersion)
      throw new Error('Restored App DB schema version is unexpected');
    for (const table of keyTables)
      await client.unsafe(`select 1 from "${table}" limit 1`);

    const evidence = { keyTables: [...keyTables], schemaVersion };
    assertGeneralTelemetrySafe(evidence);
    return evidence;
  } finally {
    await client.end();
  }
}
