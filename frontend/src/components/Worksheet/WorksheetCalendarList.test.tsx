import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWorksheetSummary } from '../../queries/api';
import type { Season } from '../../queries/graphql-types';

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

describe('WorksheetCalendarList', () => {
  beforeEach(() => {
    vi.resetModules();
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('sessionStorage', sessionStorage);
    vi.stubGlobal('window', {
      localStorage,
      sessionStorage,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('builds anonymous empty-state term chips from non-viewed terms with courses', async () => {
    const { getAnonymousWorksheetTermChips } =
      await import('./WorksheetCalendarList');
    const chips = getAnonymousWorksheetTermChips(
      {
        term: 'SP26' as Season,
        coursesByTerm: {
          SP26: [{ sectionId: 'SP26-CSE-1', color: '#123456', hidden: false }],
          FA25: [
            { sectionId: 'FA25-CSE-1', color: '#abcdef', hidden: true },
            { sectionId: 'FA25-CSE-2', color: '#654321', hidden: false },
          ],
          WI26: [],
          UNSUPPORTED: [
            { sectionId: 'UNSUPPORTED-CSE-1', color: '#111111', hidden: false },
          ],
        },
      },
      ['WI26', 'FA25', 'SP26'] as Season[],
      'SP26' as Season,
    );

    expect(chips).toEqual([{ term: 'FA25', count: 2, label: 'Fall 2025 (2)' }]);
  });

  it('lists other terms with courses for signed-in saved worksheet empty state', async () => {
    const { getSavedWorksheetTermChips } =
      await import('./WorksheetCalendarList');

    const summaries: SavedWorksheetSummary[] = [
      {
        id: 1,
        name: 'Main Worksheet',
        term: 'SP26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 0,
      },
      {
        id: 2,
        name: 'Main Worksheet',
        term: 'FA26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 3,
      },
      {
        id: 3,
        name: 'Main Worksheet',
        term: 'WI27' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 0,
      },
    ];

    const chips = getSavedWorksheetTermChips(summaries, {}, 'SP26' as Season);

    expect(chips).toEqual([{ term: 'FA26', label: 'Fall 2026' }]);
  });

  it('returns empty when no other term holds courses', async () => {
    const { getSavedWorksheetTermChips } =
      await import('./WorksheetCalendarList');

    const summaries: SavedWorksheetSummary[] = [
      {
        id: 1,
        name: 'Main Worksheet',
        term: 'SP26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 0,
      },
      {
        id: 2,
        name: 'Main Worksheet',
        term: 'FA26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 0,
      },
    ];

    const chips = getSavedWorksheetTermChips(summaries, {}, 'SP26' as Season);
    expect(chips).toEqual([]);
  });

  it('resolves the remembered active worksheet when checking for courses', async () => {
    const { getSavedWorksheetTermChips } =
      await import('./WorksheetCalendarList');

    const summaries: SavedWorksheetSummary[] = [
      {
        id: 10,
        name: 'Main Worksheet',
        term: 'FA26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 5,
      },
      {
        id: 11,
        name: 'Lab Plan',
        term: 'FA26' as Season,
        createdAt: 2,
        updatedAt: 2,
        private: true,
        isMain: false,
        sectionCount: 0,
      },
    ];

    // Remembered active is worksheet 11 (empty): no chip
    const chips = getSavedWorksheetTermChips(
      summaries,
      { FA26: 11 },
      'SP26' as Season,
    );
    expect(chips).toEqual([]);

    // Remembered active is worksheet 10 (has courses): chip
    const chips2 = getSavedWorksheetTermChips(
      summaries,
      { FA26: 10 },
      'SP26' as Season,
    );
    expect(chips2).toEqual([{ term: 'FA26', label: 'Fall 2026' }]);
  });

  it('omits saved worksheet chips outside the Worksheet term window', async () => {
    const { getSavedWorksheetTermChips } =
      await import('./WorksheetCalendarList');
    const summaries: SavedWorksheetSummary[] = [
      {
        id: 1,
        name: 'Spring Plan',
        term: 'SP26' as Season,
        createdAt: 1,
        updatedAt: 1,
        private: true,
        isMain: true,
        sectionCount: 1,
      },
      {
        id: 2,
        name: 'Summer Plan',
        term: 'S126' as Season,
        createdAt: 2,
        updatedAt: 2,
        private: true,
        isMain: true,
        sectionCount: 1,
      },
    ];

    expect(getSavedWorksheetTermChips(summaries, {}, 'FA26' as Season)).toEqual(
      [{ term: 'S126', label: 'Summer Session 1 2026' }],
    );
  });
});
