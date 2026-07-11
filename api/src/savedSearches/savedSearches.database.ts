import { and, desc, eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import type {
  SavedSearchRecord,
  SavedSearchStore,
} from './savedSearches.store.js';
import { savedSearches } from '../../drizzle/schema.js';
import type * as schema from '../../drizzle/schema.js';
import { appUserIdToLegacyNetId } from '../auth/ucsdIdentity.js';

type SavedSearchDatabase = ReturnType<typeof drizzle<typeof schema>>;

const savedSearchColumns = {
  id: savedSearches.id,
  name: savedSearches.name,
  queryString: savedSearches.queryString,
  createdAt: savedSearches.createdAt,
};

export function createDatabaseSavedSearchStore(
  db: SavedSearchDatabase,
): SavedSearchStore {
  return {
    async listByUserId(userId) {
      return await db.query.savedSearches.findMany({
        where: eq(savedSearches.userId, userId),
        columns: {
          id: true,
          name: true,
          queryString: true,
          createdAt: true,
        },
        orderBy: [desc(savedSearches.createdAt)],
      });
    },
    async createForUserId(userId, name, queryString, createdAt) {
      const [created] = await db
        .insert(savedSearches)
        .values({
          userId,
          netId: appUserIdToLegacyNetId(userId),
          name,
          queryString,
          createdAt,
        })
        .onConflictDoNothing({
          target: [savedSearches.userId, savedSearches.name],
        })
        .returning(savedSearchColumns);
      return (created ?? null) as SavedSearchRecord | null;
    },
    async deleteForUserId(userId, id) {
      const [deleted] = await db
        .delete(savedSearches)
        .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
        .returning({ id: savedSearches.id });
      return Boolean(deleted);
    },
  };
}
