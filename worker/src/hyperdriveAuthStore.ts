import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../../api/drizzle/schema.js';
import { createDatabaseUcsdAuthStore } from '../../api/src/auth/ucsdAuth.database.js';

export interface NoCacheHyperdriveBinding {
  connectionString: string;
}

export function createHyperdriveAuthStore(
  hyperdrive: NoCacheHyperdriveBinding,
) {
  if (!hyperdrive.connectionString)
    throw new Error('No-cache App DB Hyperdrive binding is required');
  const client = postgres(hyperdrive.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: true,
  });
  return {
    store: createDatabaseUcsdAuthStore(drizzle(client, { schema })),
    close: () => client.end({ timeout: 0 }),
  };
}
