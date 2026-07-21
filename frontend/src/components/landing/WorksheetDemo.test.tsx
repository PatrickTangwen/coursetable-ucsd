import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WorksheetDemo from './WorksheetDemo';

describe('WorksheetDemo', () => {
  it('keeps course sections out of the grid and course cards', () => {
    const html = renderToStaticMarkup(<WorksheetDemo />);

    expect(html).not.toContain('A01');
    expect(html).not.toContain('B01');
    expect(html).not.toContain('001');
  });

  it('shows the busiest-day indicator and only the toolbar eye icon', () => {
    const html = renderToStaticMarkup(<WorksheetDemo />);

    expect(html).toContain('5 classes ›');
    expect(html.match(/M1 12s4-8 11-8/gu)).toHaveLength(1);
  });
});
