import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('ResultsHeaders', () => {
  beforeAll(() => {
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
  });

  it('does not include archived GPA columns in list view', async () => {
    const { default: ResultsHeaders } = await import('./ResultsHeaders');

    const html = renderToStaticMarkup(
      <ResultsHeaders
        multiSeasons={false}
        isListView
        setIsListView={() => {}}
        numResults={1}
        allowViewToggle={false}
      />,
    );

    expect(html).not.toContain('Average GPA');
    expect(html).not.toContain('Record Count');
    expect(html).toContain('Code');
    expect(html).toContain('Instructors');
  });
});
