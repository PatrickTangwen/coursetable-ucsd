import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';
import { useStore } from '../store';

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
});

function renderHome(publicLoginEnabled: boolean) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Home publicLoginEnabled={publicLoginEnabled} />
    </MemoryRouter>,
  );
}

describe('Home public login entries', () => {
  beforeEach(() => {
    useStore.setState({ authStatus: 'unauthenticated', user: undefined });
  });

  it('renders sign-in entry points when public login is enabled', () => {
    const html = renderHome(true);

    expect(html).toContain('href="/login"');
    expect(html).toContain('Get Started');
    expect(html).toContain('student@ucsd.edu');
    expect(html).toContain('Sign in to save');
  });

  it('hides sign-in entry points while keeping anonymous browsing when disabled', () => {
    const html = renderHome(false);

    expect(html).not.toContain('href="/login"');
    expect(html).toContain('Get Started');
    expect(html).not.toContain('student@ucsd.edu');
    expect(html).not.toContain('Sign in to save');
    expect(html).toContain('Search the catalog');
    expect(html).toContain('Browse without an account');
  });

  it('describes worksheet calendar exports without promising live sync', () => {
    const html = renderHome(true);

    expect(html).toContain('Export your calendar');
    expect(html).toContain('Download an ICS file');
    expect(html).toContain('save your weekly grid as a PNG');
    expect(html).not.toContain('Sync with your calendar');
    expect(html).not.toContain('stays in sync');
  });

  it('opens the rendered landing-page FAQ entries in a new Tally tab', () => {
    const html = renderHome(true);
    const faqLinks = html.match(
      /href="https:\/\/tally\.so\/r\/q47EA8"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/gu,
    );

    // The desktop header and footer render immediately. The matching mobile
    // menu entry is mounted only after the menu is opened in the browser.
    expect(faqLinks).toHaveLength(2);
  });

  it('links the landing-page footer to the privacy policy', () => {
    const html = renderHome(true);

    expect(html).toContain('href="/privacypolicy"');
    expect(html).toContain('Privacy Policy');
  });
});
