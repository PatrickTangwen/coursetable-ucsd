import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { resolvePublicLoginRoute } from './utilities/publicLogin';

function RoutePolicyHarness({
  authenticated,
  publicLoginEnabled,
}: {
  readonly authenticated: boolean;
  readonly publicLoginEnabled: boolean;
}) {
  const location = useLocation();
  const decision = resolvePublicLoginRoute(
    location.pathname,
    authenticated,
    publicLoginEnabled,
  );

  if (decision.type === 'redirect')
    return <span data-redirect-to={decision.to}>Redirect</span>;
  return <span data-route-allowed={location.pathname}>Allowed</span>;
}

function renderRoute(
  pathname: string,
  publicLoginEnabled: boolean,
  authenticated = false,
) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <RoutePolicyHarness
        authenticated={authenticated}
        publicLoginEnabled={publicLoginEnabled}
      />
    </MemoryRouter>,
  );
}

describe('public login route policy', () => {
  it('allows login when enabled and redirects it to catalog when disabled', () => {
    expect(renderRoute('/login', true)).toContain(
      'data-route-allowed="/login"',
    );
    expect(renderRoute('/login', false)).toContain(
      'data-redirect-to="/catalog"',
    );
  });

  it('keeps anonymous catalog and worksheet routes available when disabled', () => {
    expect(renderRoute('/catalog', false)).toContain(
      'data-route-allowed="/catalog"',
    );
    expect(renderRoute('/worksheet', false)).toContain(
      'data-route-allowed="/worksheet"',
    );
  });

  it('redirects protected routes according to availability', () => {
    expect(renderRoute('/profile', true)).toContain(
      'data-redirect-to="/login"',
    );
    expect(renderRoute('/profile', false)).toContain(
      'data-redirect-to="/catalog"',
    );
  });

  it('keeps authenticated protected routes available while public login is off', () => {
    expect(renderRoute('/profile', false, true)).toContain(
      'data-route-allowed="/profile"',
    );
  });
});
