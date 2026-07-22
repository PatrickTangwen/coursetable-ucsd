import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CatalogDisclaimer from './CatalogDisclaimer';

describe('CatalogDisclaimer', () => {
  it('summarizes the independent planner and enrollment limitations', () => {
    const html = renderToStaticMarkup(<CatalogDisclaimer />);

    expect(html).toContain('not affiliated with UC San Diego');
    expect(html).toContain('Seats are not live');
    expect(html).toContain('Selecting courses here does not enroll you in TSS');
  });

  it('renders the FAQ link and dismiss control', () => {
    const html = renderToStaticMarkup(<CatalogDisclaimer />);

    expect(html).toContain('href="https://tally.so/r/q47EA8"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('aria-label="Dismiss catalog notice"');
  });
});
