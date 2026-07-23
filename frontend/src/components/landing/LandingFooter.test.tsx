import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LandingFooter from './LandingFooter';

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
});

function renderFooter(pathname: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <LandingFooter publicLoginEnabled={false} />
    </MemoryRouter>,
  );
}

describe('LandingFooter', () => {
  it('uses local section links on the landing page', () => {
    const html = renderFooter('/');

    expect(html.match(/href="#top"/gu)).toHaveLength(2);
    expect(html).toContain('href="#worksheet"');
    expect(html).toContain('href="#how"');
  });

  it('returns to landing sections from the privacy page', () => {
    const html = renderFooter('/privacypolicy');

    expect(html).toContain('href="/#worksheet"');
    expect(html).toContain('href="/#how"');
    expect(html).toContain('href="/catalog"');
    expect(html).not.toContain('href="/privacypolicy"');
    expect(html).toContain('href="https://tally.so/r/q47EA8"');
  });

  it('hides the disabled Privacy Policy link', () => {
    const html = renderFooter('/');

    expect(html).not.toContain('href="/privacypolicy"');
    expect(html).not.toContain('Privacy Policy');
  });

  it('opens the sushi support button in a new Buy Me a Coffee tab', () => {
    const html = renderFooter('/');

    expect(html).toContain('href="https://buymeacoffee.com/sungrid"');
    expect(html).toContain('Buy me sushi');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('button.prod.min.js');
  });
});
