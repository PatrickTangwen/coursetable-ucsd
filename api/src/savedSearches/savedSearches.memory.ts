import type {
  SavedSearchRecord,
  SavedSearchStore,
} from './savedSearches.store.js';

export function createMemorySavedSearchStore(): SavedSearchStore & {
  recordsByUserId: Map<number, SavedSearchRecord[]>;
} {
  const recordsByUserId = new Map<number, SavedSearchRecord[]>();
  let nextId = 1;

  return {
    recordsByUserId,
    listByUserId(userId) {
      return Promise.resolve(
        [...(recordsByUserId.get(userId) ?? [])].sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
      );
    },
    createForUserId(userId, name, queryString, createdAt) {
      const records = recordsByUserId.get(userId) ?? [];
      if (records.some((record) => record.name === name))
        return Promise.resolve(null);
      const created = {
        id: nextId++,
        name,
        queryString,
        createdAt,
      };
      recordsByUserId.set(userId, [created, ...records]);
      return Promise.resolve(created);
    },
    deleteForUserId(userId, id) {
      const records = recordsByUserId.get(userId) ?? [];
      const next = records.filter((record) => record.id !== id);
      if (next.length === records.length) return Promise.resolve(false);
      recordsByUserId.set(userId, next);
      return Promise.resolve(true);
    },
  };
}
