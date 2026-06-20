export interface SavedSearchRecord {
  id: number;
  name: string;
  queryString: string;
  createdAt: number;
}

export interface SavedSearchStore {
  listByUserId: (userId: number) => Promise<SavedSearchRecord[]>;
  createForUserId: (
    userId: number,
    name: string,
    queryString: string,
    createdAt: number,
  ) => Promise<SavedSearchRecord | null>;
  deleteForUserId: (userId: number, id: number) => Promise<boolean>;
}
