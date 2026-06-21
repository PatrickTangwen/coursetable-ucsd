import {
  dedupeSavedWorksheetSections,
  summarizeSavedWorksheet,
  type SavedWorksheetRecord,
  type SavedWorksheetStore,
} from './savedWorksheets.store.js';

function cloneSavedWorksheet(
  worksheet: SavedWorksheetRecord,
): SavedWorksheetRecord {
  return {
    ...worksheet,
    sections: worksheet.sections.map((section) => ({ ...section })),
  };
}

export function createMemorySavedWorksheetStore(): SavedWorksheetStore & {
  recordsByUserId: Map<number, SavedWorksheetRecord[]>;
} {
  const recordsByUserId = new Map<number, SavedWorksheetRecord[]>();
  let nextId = 1;

  return {
    recordsByUserId,
    listByUserId(userId) {
      return Promise.resolve(
        [...(recordsByUserId.get(userId) ?? [])]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(summarizeSavedWorksheet),
      );
    },
    getForUserId(userId, id) {
      const record =
        recordsByUserId.get(userId)?.find((worksheet) => worksheet.id === id) ??
        null;
      return Promise.resolve(record ? cloneSavedWorksheet(record) : null);
    },
    createForUserId(userId, input, createdAt) {
      const records = recordsByUserId.get(userId) ?? [];
      const created = {
        id: nextId++,
        name: input.name,
        term: input.term,
        createdAt,
        updatedAt: createdAt,
        private: true,
        sections: dedupeSavedWorksheetSections(input.sections),
      };
      recordsByUserId.set(userId, [created, ...records]);
      return Promise.resolve(cloneSavedWorksheet(created));
    },
  };
}
