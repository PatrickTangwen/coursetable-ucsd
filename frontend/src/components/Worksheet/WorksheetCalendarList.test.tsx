import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
