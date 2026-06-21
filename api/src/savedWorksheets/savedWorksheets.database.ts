import { and, asc, desc, eq } from 'drizzle-orm';

import {
  dedupeSavedWorksheetSections,
  type SavedWorksheetRecord,
  type SavedWorksheetStore,
  type SavedWorksheetSummary,
} from './savedWorksheets.store.js';
import {
  savedWorksheetSections,
  savedWorksheets,
} from '../../drizzle/schema.js';
import { db } from '../config.js';

const savedWorksheetColumns = {
  id: savedWorksheets.id,
  name: savedWorksheets.name,
  term: savedWorksheets.term,
  createdAt: savedWorksheets.createdAt,
  updatedAt: savedWorksheets.updatedAt,
  private: savedWorksheets.private,
};

const savedWorksheetSectionColumns = {
  sectionId: savedWorksheetSections.sectionId,
  color: savedWorksheetSections.color,
  hidden: savedWorksheetSections.hidden,
};

async function getSections(worksheetId: number) {
  return await db
    .select(savedWorksheetSectionColumns)
    .from(savedWorksheetSections)
    .where(eq(savedWorksheetSections.worksheetId, worksheetId))
    .orderBy(asc(savedWorksheetSections.id));
}

export function createDatabaseSavedWorksheetStore(): SavedWorksheetStore {
  return {
    async listByUserId(userId) {
      const records = await db
        .select(savedWorksheetColumns)
        .from(savedWorksheets)
        .where(eq(savedWorksheets.userId, userId))
        .orderBy(desc(savedWorksheets.createdAt));

      return await Promise.all(
        records.map(async (record): Promise<SavedWorksheetSummary> => {
          const sections = await getSections(record.id);
          return {
            ...record,
            sectionCount: sections.length,
          };
        }),
      );
    },
    async getForUserId(userId, id) {
      const [record] = await db
        .select(savedWorksheetColumns)
        .from(savedWorksheets)
        .where(
          and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
        )
        .limit(1);

      if (!record) return null;

      return {
        ...record,
        sections: await getSections(record.id),
      };
    },
    async createForUserId(userId, input, createdAt) {
      const sections = dedupeSavedWorksheetSections(input.sections);

      return await db.transaction(async (tx): Promise<SavedWorksheetRecord> => {
        const [created] = await tx
          .insert(savedWorksheets)
          .values({
            userId,
            name: input.name,
            term: input.term,
            createdAt,
            updatedAt: createdAt,
            private: true,
          })
          .returning(savedWorksheetColumns);

        if (!created) throw new Error('Failed to create saved worksheet');

        if (sections.length > 0) {
          await tx.insert(savedWorksheetSections).values(
            sections.map((section) => ({
              worksheetId: created.id,
              sectionId: section.sectionId,
              color: section.color,
              hidden: section.hidden,
            })),
          );
        }

        return {
          ...created,
          sections,
        };
      });
    },
  };
}
