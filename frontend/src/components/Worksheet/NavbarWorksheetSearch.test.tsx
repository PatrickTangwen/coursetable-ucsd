import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../../queries/graphql-types';

const mainWorksheet = {
  id: 10,
  name: 'Main Worksheet',
  term: 'S126' as Season,
  createdAt: 1,
  updatedAt: 1,
  private: true,
  isMain: true,
  sourceSectionCount: 0,
  savedSectionCount: 0,
  sections: [],
};

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

describe('NavbarWorksheetSearch', () => {
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

  it('shows UCSD signed-in worksheet header state without unsupported controls', async () => {
    const { NavbarWorksheetSearchView } =
      await import('./NavbarWorksheetSearch');

    const renderView = (worksheetView: 'calendar' | 'list') =>
      renderToStaticMarkup(
        <NavbarWorksheetSearchView
          isMobile={false}
          worksheetView={worksheetView}
          changeWorksheetView={() => {}}
          isExoticWorksheet={false}
          exitExoticWorksheet={() => {}}
          hasLegacyWorksheetAccount={false}
          hasSavedWorksheetAccount
          activeSavedWorksheet={mainWorksheet}
          savedWorksheetSummaries={[{ ...mainWorksheet, sectionCount: 0 }]}
          selectSavedWorksheet={() => Promise.resolve(true)}
          createBlankSavedWorksheetForTerm={() => Promise.resolve(true)}
          renameSavedWorksheet={() => Promise.resolve(true)}
          deleteSavedWorksheet={() => Promise.resolve(true)}
          onSwitchTerm={() => {}}
          seasonOptions={[{ value: 'S126', label: 'Summer Session 1 2026' }]}
          viewedSeason={'S126' as Season}
        />,
      );

    const calendarHtml = renderView('calendar');
    expect(calendarHtml).toContain('Calendar');
    expect(calendarHtml).toContain('List');
    expect(calendarHtml).toContain('Summer Session 1 2026');
    // The calendar sidebar owns the worksheet picker; the navbar must not
    // duplicate it (finalized SunGrid design).
    expect(calendarHtml).not.toContain('Main Worksheet');
    expect(calendarHtml).not.toContain('Map');
    expect(calendarHtml).not.toContain('Friends');
    expect(calendarHtml).not.toContain('Add Friend');

    // The list view has no other worksheet switcher, so the navbar keeps it.
    const listHtml = renderView('list');
    expect(listHtml).toContain('Summer Session 1 2026');
    expect(listHtml).toContain('Main Worksheet');
  });

  it('shows the term selector for signed-out desktop worksheet users', async () => {
    const { NavbarWorksheetSearchView } =
      await import('./NavbarWorksheetSearch');

    const html = renderToStaticMarkup(
      <NavbarWorksheetSearchView
        isMobile={false}
        worksheetView="calendar"
        changeWorksheetView={() => {}}
        isExoticWorksheet={false}
        exitExoticWorksheet={() => {}}
        hasLegacyWorksheetAccount={false}
        hasSavedWorksheetAccount={false}
        activeSavedWorksheet={undefined}
        savedWorksheetSummaries={[]}
        selectSavedWorksheet={() => Promise.resolve(true)}
        createBlankSavedWorksheetForTerm={() => Promise.resolve(true)}
        renameSavedWorksheet={() => Promise.resolve(true)}
        deleteSavedWorksheet={() => Promise.resolve(true)}
        onSwitchTerm={() => {}}
        seasonOptions={[{ value: 'SP26', label: 'Spring 2026' }]}
        viewedSeason={'SP26' as Season}
      />,
    );

    expect(html).toContain('Calendar');
    expect(html).toContain('List');
    // The signed-out term selector reads the store's viewed season (not the
    // seasonOptions prop), so assert the dropdown itself rather than a
    // specific season label.
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain('Main Worksheet');
    expect(html).not.toContain('New Worksheet');
  });

  it('builds anonymous worksheet term labels with hidden courses counted', async () => {
    const { getAnonymousWorksheetCourseCountsByTerm, getSeasonLabel } =
      await import('./SeasonDropdown');
    const counts = getAnonymousWorksheetCourseCountsByTerm({
      term: 'SP26' as Season,
      coursesByTerm: {
        SP26: [
          { sectionId: 'SP26-CSE-1', color: '#123456', hidden: false },
          { sectionId: 'SP26-CSE-2', color: '#abcdef', hidden: true },
        ],
        FA25: [],
      },
    });

    expect(counts.SP26).toBe(2);
    expect(counts.FA25).toBeUndefined();
    expect(getSeasonLabel('SP26' as Season, counts.SP26)).toBe(
      'Spring 2026 · 2',
    );
    expect(getSeasonLabel('FA25' as Season, counts.FA25)).toBe('Fall 2025');
  });

  it('shows active-term Saved Worksheets and a blank-create action in the selector menu', async () => {
    const { SavedWorksheetMenuView } = await import('./NavbarWorksheetSearch');

    const html = renderToStaticMarkup(
      <SavedWorksheetMenuView
        term={'S126' as Season}
        activeWorksheetId={10}
        savedWorksheetSummaries={[
          { ...mainWorksheet, sectionCount: 0 },
          {
            id: 11,
            name: 'Summer Plan',
            term: 'S126' as Season,
            createdAt: 2,
            updatedAt: 2,
            private: true,
            isMain: false,
            sectionCount: 0,
          },
          {
            id: 12,
            name: 'Fall Plan',
            term: 'FA26' as Season,
            createdAt: 3,
            updatedAt: 3,
            private: true,
            isMain: false,
            sectionCount: 0,
          },
        ]}
        onSelectSavedWorksheet={() => Promise.resolve()}
        onCreateBlankSavedWorksheet={() => Promise.resolve()}
        onRenameSavedWorksheet={() => Promise.resolve()}
        onDeleteSavedWorksheet={() => Promise.resolve()}
        isCreating={false}
      />,
    );

    expect(html).toContain('Main Worksheet');
    expect(html).toContain('Summer Plan');
    expect(html).toContain('Private Saved Worksheet');
    expect(html).toContain('aria-label="Rename Summer Plan"');
    expect(html).toContain('aria-label="Delete Summer Plan"');
    expect(html).toContain('New Worksheet');
    expect(html).not.toContain('Fall Plan');
    expect(html).not.toContain('Public Worksheet');
    expect(html).not.toContain('aria-label="Rename Main Worksheet"');
    expect(html).not.toContain('aria-label="Delete Main Worksheet"');
  });
});
