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

    expect(html).toContain('href="#worksheet"');
    expect(html).toContain('href="#how"');
  });

  it('returns to landing sections from the privacy page', () => {
    const html = renderFooter('/privacypolicy');

    expect(html).toContain('href="/#worksheet"');
    expect(html).toContain('href="/#how"');
    expect(html).toContain('href="/privacypolicy"');
    expect(html).toContain('href="https://tally.so/r/q47EA8"');
  });
});
