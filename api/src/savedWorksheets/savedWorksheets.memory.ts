import {
  dedupeSavedWorksheetSections,
  MAIN_SAVED_WORKSHEET_NAME,
  summarizeSavedWorksheet,
  type SavedWorksheetRecord,
  type SavedWorksheetCreateInput,
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

  const createRecord = (
    userId: number,
    input: SavedWorksheetCreateInput,
    createdAt: number,
  ) => {
    const records = recordsByUserId.get(userId) ?? [];
    const created = {
      id: nextId++,
      name: input.name,
      term: input.term,
      createdAt,
      updatedAt: createdAt,
      private: true,
      isMain: input.isMain ?? false,
      sections: dedupeSavedWorksheetSections(input.sections),
    };
    recordsByUserId.set(userId, [created, ...records]);
    return cloneSavedWorksheet(created);
  };

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
      return Promise.resolve(createRecord(userId, input, createdAt));
    },
    ensureMainForUserId(userId, term, createdAt) {
      const existing =
        recordsByUserId
          .get(userId)
          ?.find((worksheet) => worksheet.term === term && worksheet.isMain) ??
        null;
      if (existing) return Promise.resolve(cloneSavedWorksheet(existing));

      return Promise.resolve(
        createRecord(
          userId,
          {
            name: MAIN_SAVED_WORKSHEET_NAME,
            term,
            isMain: true,
            sections: [],
          },
          createdAt,
        ),
      );
    },
  };
}
