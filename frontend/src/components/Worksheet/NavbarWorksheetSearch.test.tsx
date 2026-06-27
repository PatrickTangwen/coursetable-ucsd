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
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
  });

  it('shows UCSD signed-in worksheet header state without unsupported controls', async () => {
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
        hasSavedWorksheetAccount
        activeSavedWorksheet={mainWorksheet}
        savedWorksheetSummaries={[{ ...mainWorksheet, sectionCount: 0 }]}
        savedWorksheetListStatus="ready"
        savedWorksheetBootstrapStatus="ready"
        selectSavedWorksheet={() => Promise.resolve(true)}
        createBlankSavedWorksheetForTerm={() => Promise.resolve(true)}
        renameSavedWorksheet={() => Promise.resolve(true)}
        deleteSavedWorksheet={() => Promise.resolve(true)}
      />,
    );

    expect(html).toContain('Calendar');
    expect(html).toContain('List');
    expect(html).toContain('S126');
    expect(html).toContain('Main Worksheet');
    expect(html).not.toContain('Map');
    expect(html).not.toContain('Friends');
    expect(html).not.toContain('Add Friend');
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
        savedWorksheetListStatus="idle"
        savedWorksheetBootstrapStatus="idle"
        selectSavedWorksheet={() => Promise.resolve(true)}
        createBlankSavedWorksheetForTerm={() => Promise.resolve(true)}
        renameSavedWorksheet={() => Promise.resolve(true)}
        deleteSavedWorksheet={() => Promise.resolve(true)}
      />,
    );

    expect(html).toContain('Calendar');
    expect(html).toContain('List');
    expect(html).toContain('Spring 2026');
    expect(html).not.toContain('New Worksheet');
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
