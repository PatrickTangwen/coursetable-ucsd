import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../../api/drizzle/schema.js';
import { createDatabaseUcsdAuthStore } from '../../api/src/auth/ucsdAuth.database.js';
import { createDatabaseSavedSearchStore } from '../../api/src/savedSearches/savedSearches.database.js';
import { createDatabaseSavedWorksheetStore } from '../../api/src/savedWorksheets/savedWorksheets.database.js';

export interface NoCacheHyperdriveBinding {
  connectionString: string;
}

export function createHyperdriveAppDatabase(
  hyperdrive: NoCacheHyperdriveBinding,
) {
  if (!hyperdrive.connectionString)
    throw new Error('No-cache App DB Hyperdrive binding is required');
  const client = postgres(hyperdrive.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: true,
  });
  const database = drizzle(client, { schema });
  return {
    auth: createDatabaseUcsdAuthStore(database),
    savedSearches: createDatabaseSavedSearchStore(database),
    savedWorksheets: createDatabaseSavedWorksheetStore(database),
    close: () => client.end({ timeout: 0 }),
  };
}
