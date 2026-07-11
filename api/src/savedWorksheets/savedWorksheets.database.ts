import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import {
  dedupeSavedWorksheetSections,
  MAIN_SAVED_WORKSHEET_NAME,
  type SavedWorksheetRecord,
  type SavedWorksheetCreateInput,
  type SavedWorksheetStore,
  type SavedWorksheetSummary,
} from './savedWorksheets.store.js';
import {
  savedWorksheetSections,
  savedWorksheets,
} from '../../drizzle/schema.js';
import type * as schema from '../../drizzle/schema.js';

type SavedWorksheetDatabase = ReturnType<typeof drizzle<typeof schema>>;

const savedWorksheetColumns = {
  id: savedWorksheets.id,
  name: savedWorksheets.name,
  term: savedWorksheets.term,
  createdAt: savedWorksheets.createdAt,
  updatedAt: savedWorksheets.updatedAt,
  private: savedWorksheets.private,
  isMain: savedWorksheets.isMain,
};

const savedWorksheetSectionColumns = {
  sectionId: savedWorksheetSections.sectionId,
  color: savedWorksheetSections.color,
  hidden: savedWorksheetSections.hidden,
};

async function getSections(db: SavedWorksheetDatabase, worksheetId: number) {
  return await db
    .select(savedWorksheetSectionColumns)
    .from(savedWorksheetSections)
    .where(eq(savedWorksheetSections.worksheetId, worksheetId))
    .orderBy(asc(savedWorksheetSections.id));
}

async function getMainSavedWorksheet(
  db: SavedWorksheetDatabase,
  userId: number,
  term: string,
) {
  const [record] = await db
    .select(savedWorksheetColumns)
    .from(savedWorksheets)
    .where(
      and(
        eq(savedWorksheets.userId, userId),
        eq(savedWorksheets.term, term),
        eq(savedWorksheets.isMain, true),
      ),
    )
    .limit(1);

  if (!record) return null;

  return {
    ...record,
    sections: await getSections(db, record.id),
  };
}

async function createSavedWorksheetRecord(
  db: SavedWorksheetDatabase,
  userId: number,
  input: SavedWorksheetCreateInput,
  createdAt: number,
) {
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
        isMain: input.isMain ?? false,
        mainWorksheetKey: input.isMain ? 'main' : null,
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
}

export function createDatabaseSavedWorksheetStore(
  db: SavedWorksheetDatabase,
): SavedWorksheetStore {
  return {
    async listByUserId(userId) {
      const records = await db
        .select(savedWorksheetColumns)
        .from(savedWorksheets)
        .where(eq(savedWorksheets.userId, userId))
        .orderBy(desc(savedWorksheets.createdAt));

      return await Promise.all(
        records.map(async (record): Promise<SavedWorksheetSummary> => {
          const sections = await getSections(db, record.id);
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
        sections: await getSections(db, record.id),
      };
    },
    async createForUserId(userId, input, createdAt) {
      return await createSavedWorksheetRecord(db, userId, input, createdAt);
    },
    async ensureMainForUserId(userId, term, createdAt) {
      const existing = await getMainSavedWorksheet(db, userId, term);
      if (existing) return existing;

      try {
        return await createSavedWorksheetRecord(
          db,
          userId,
          {
            name: MAIN_SAVED_WORKSHEET_NAME,
            term,
            isMain: true,
            sections: [],
          },
          createdAt,
        );
      } catch (error: unknown) {
        const createdByConcurrentRequest = await getMainSavedWorksheet(
          db,
          userId,
          term,
        );
        if (createdByConcurrentRequest) return createdByConcurrentRequest;
        throw error;
      }
    },
    async renameForUserId(userId, id, name, updatedAt) {
      const [existing] = await db
        .select(savedWorksheetColumns)
        .from(savedWorksheets)
        .where(
          and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
        )
        .limit(1);

      if (!existing) return { status: 'not-found' };
      if (existing.isMain) return { status: 'cannot-rename-main' };

      const [updated] = await db
        .update(savedWorksheets)
        .set({ name, updatedAt })
        .where(
          and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
        )
        .returning(savedWorksheetColumns);

      if (!updated) return { status: 'not-found' };

      return {
        status: 'renamed',
        worksheet: {
          ...updated,
          sections: await getSections(db, updated.id),
        },
      };
    },
    async deleteForUserId(userId, id) {
      return await db.transaction(async (tx) => {
        const [target] = await tx
          .select(savedWorksheetColumns)
          .from(savedWorksheets)
          .where(
            and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
          )
          .limit(1);

        if (!target) return { status: 'not-found' };

        const [termCount] = await tx
          .select({ recordCount: count() })
          .from(savedWorksheets)
          .where(
            and(
              eq(savedWorksheets.userId, userId),
              eq(savedWorksheets.term, target.term),
            ),
          );
        if ((termCount?.recordCount ?? 0) <= 1)
          return { status: 'cannot-delete-only' };
        if (target.isMain) return { status: 'cannot-delete-main' };

        const [fallbackRecord] = await tx
          .select(savedWorksheetColumns)
          .from(savedWorksheets)
          .where(
            and(
              eq(savedWorksheets.userId, userId),
              eq(savedWorksheets.term, target.term),
              eq(savedWorksheets.isMain, true),
            ),
          )
          .limit(1);
        const fallbackSections = fallbackRecord
          ? await tx
              .select(savedWorksheetSectionColumns)
              .from(savedWorksheetSections)
              .where(eq(savedWorksheetSections.worksheetId, fallbackRecord.id))
              .orderBy(asc(savedWorksheetSections.id))
          : [];

        await tx
          .delete(savedWorksheetSections)
          .where(eq(savedWorksheetSections.worksheetId, target.id));
        const [deleted] = await tx
          .delete(savedWorksheets)
          .where(
            and(
              eq(savedWorksheets.userId, userId),
              eq(savedWorksheets.id, target.id),
            ),
          )
          .returning({
            id: savedWorksheets.id,
            term: savedWorksheets.term,
          });

        if (!deleted) return { status: 'not-found' };

        return {
          status: 'deleted',
          deletedId: deleted.id,
          term: deleted.term,
          fallbackWorksheet: fallbackRecord
            ? {
                ...fallbackRecord,
                sections: fallbackSections,
              }
            : null,
        };
      });
    },
    async replaceSectionsForUserId(userId, id, sections, updatedAt) {
      const nextSections = dedupeSavedWorksheetSections(sections);

      return await db.transaction(async (tx) => {
        const [existing] = await tx
          .select(savedWorksheetColumns)
          .from(savedWorksheets)
          .where(
            and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
          )
          .limit(1);

        if (!existing) return { status: 'not-found' };

        await tx
          .delete(savedWorksheetSections)
          .where(eq(savedWorksheetSections.worksheetId, existing.id));

        if (nextSections.length > 0) {
          await tx.insert(savedWorksheetSections).values(
            nextSections.map((section) => ({
              worksheetId: existing.id,
              sectionId: section.sectionId,
              color: section.color,
              hidden: section.hidden,
            })),
          );
        }

        const [updated] = await tx
          .update(savedWorksheets)
          .set({ updatedAt })
          .where(
            and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.id, id)),
          )
          .returning(savedWorksheetColumns);

        if (!updated) return { status: 'not-found' };

        return {
          status: 'updated',
          worksheet: {
            ...updated,
            sections: nextSections,
          },
        };
      });
    },
  };
}
