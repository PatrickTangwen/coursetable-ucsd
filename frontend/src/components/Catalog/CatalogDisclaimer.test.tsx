import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CatalogDisclaimer from './CatalogDisclaimer';

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  Object.assign(globalThis, { localStorage: storage });
});

describe('CatalogDisclaimer', () => {
  it('summarizes the independent planner and enrollment limitations', () => {
    const html = renderToStaticMarkup(<CatalogDisclaimer />);

    expect(html).toContain('not affiliated with UC San Diego');
    expect(html).toContain('Seat counts are not real-time');
    expect(html).toContain('course selections here do not enroll you in TSS');
  });

  it('renders the FAQ link and dismiss control', () => {
    const html = renderToStaticMarkup(<CatalogDisclaimer />);

    expect(html).toContain('href="https://tally.so/r/q47EA8"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('aria-label="Dismiss catalog notice"');
  });
});
