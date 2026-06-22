import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../../queries/graphql-types';

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
    removeItem(key: string) {
      return items.delete(key);
    },
  };
}

describe('LocalWorksheetImportPromptView', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
  });

  it('shows an explicit Local Worksheet account-save action', async () => {
    const { LocalWorksheetImportPromptView } =
      await import('./LocalWorksheetImportPrompt');

    const html = renderToStaticMarkup(
      <LocalWorksheetImportPromptView
        localSectionCount={2}
        defaultTerm={'S126' as Season}
        name="S126 Worksheet"
        isSaving={false}
        savedWorksheetName={null}
        onNameChange={() => {}}
        onSave={() => {}}
      />,
    );

    expect(html).toContain('Local Worksheet');
    expect(html).toContain('2 sections');
    expect(html).toContain('Save Local Worksheet');
    expect(html).not.toContain('New Worksheet');
  });

  it('does not render when the Local Worksheet is empty', async () => {
    const { LocalWorksheetImportPromptView } =
      await import('./LocalWorksheetImportPrompt');

    const html = renderToStaticMarkup(
      <LocalWorksheetImportPromptView
        localSectionCount={0}
        defaultTerm={'S126' as Season}
        name="S126 Worksheet"
        isSaving={false}
        savedWorksheetName={null}
        onNameChange={() => {}}
        onSave={() => {}}
      />,
    );

    expect(html).toBe('');
  });
});
