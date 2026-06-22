import { renderToStaticMarkup } from 'react-dom/server';
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
        activeSavedWorksheet={{
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
        }}
        savedWorksheetBootstrapStatus="ready"
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
});
