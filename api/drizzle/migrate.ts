import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DB_URL;

if (!databaseUrl) 
  throw new Error('env config missing: DB_URL');


const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
} finally {
  await client.end();
}
