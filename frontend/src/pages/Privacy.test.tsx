import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Privacy from './Privacy.mdx';

describe('Privacy policy', () => {
  it('renders the complete publishable policy without template placeholders', () => {
    const html = renderToStaticMarkup(<Privacy />);

    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Privacy at a Glance');
    expect(html).toContain('20. Contact Us');
    expect(html).toContain('July 21, 2026');
    expect(html).toContain('Sungridplanner@gmail.com');
    expect(html).toContain('Cloudflare');
    expect(html).toContain('Neon');
    expect(html).toContain('Resend');
    expect(html).toContain('Tally');
    expect(html).toContain('Buy Me a Coffee');
    expect(html).toContain('Sentry');
    expect(html).not.toMatch(/\[(?:Provider|Month|Privacy|Account|analytics)/u);
    expect(html).not.toContain('<hr');
  });

  it('renders a linked table of contents for the policy sections', () => {
    const html = renderToStaticMarkup(<Privacy />);

    expect(html).toContain('aria-label="Privacy policy sections"');
    expect(html).toContain('href="#information-we-collect"');
    expect(html).toContain('id="information-we-collect"');
    expect(html).toContain('href="#contact"');
    expect(html).toContain('id="contact"');
  });
});
