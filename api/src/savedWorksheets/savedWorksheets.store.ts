export interface SavedWorksheetSection {
  sectionId: string;
  color: string;
  hidden: boolean;
}

export interface SavedWorksheetRecord {
  id: number;
  name: string;
  term: string;
  createdAt: number;
  updatedAt: number;
  private: boolean;
  sections: SavedWorksheetSection[];
}

export interface SavedWorksheetSummary {
  id: number;
  name: string;
  term: string;
  createdAt: number;
  updatedAt: number;
  private: boolean;
  sectionCount: number;
}

export interface SavedWorksheetCreateInput {
  name: string;
  term: string;
  sections: SavedWorksheetSection[];
}

export interface SavedWorksheetStore {
  listByUserId: (userId: number) => Promise<SavedWorksheetSummary[]>;
  getForUserId: (
    userId: number,
    id: number,
  ) => Promise<SavedWorksheetRecord | null>;
  createForUserId: (
    userId: number,
    input: SavedWorksheetCreateInput,
    createdAt: number,
  ) => Promise<SavedWorksheetRecord>;
}

export function dedupeSavedWorksheetSections(
  sections: SavedWorksheetSection[],
) {
  const seen = new Set<string>();
  const deduped: SavedWorksheetSection[] = [];
  for (const section of sections) {
    if (seen.has(section.sectionId)) continue;
    seen.add(section.sectionId);
    deduped.push(section);
  }
  return deduped;
}

export function summarizeSavedWorksheet(
  worksheet: SavedWorksheetRecord,
): SavedWorksheetSummary {
  return {
    id: worksheet.id,
    name: worksheet.name,
    term: worksheet.term,
    createdAt: worksheet.createdAt,
    updatedAt: worksheet.updatedAt,
    private: worksheet.private,
    sectionCount: worksheet.sections.length,
  };
}
