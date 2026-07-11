import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AuthRouteGate from './components/AuthRouteGate';

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
});

function renderRoute(
  pathname: string,
  publicLoginEnabled: boolean,
  authStatus: 'authenticated' | 'unauthenticated' = 'unauthenticated',
) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          element={
            <AuthRouteGate
              publicLoginEnabled={publicLoginEnabled}
              authStatus={authStatus}
              renderRedirect={(to) => (
                <span data-redirect-to={to}>Redirect</span>
              )}
            />
          }
        >
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/catalog" element={<div>Catalog page</div>} />
          <Route path="/worksheet" element={<div>Worksheet page</div>} />
          <Route path="/profile" element={<div>Profile page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthRouteGate public login behavior', () => {
  it('renders login when enabled and redirects it to catalog when disabled', () => {
    expect(renderRoute('/login', true)).toContain('Login page');
    expect(renderRoute('/login', false)).toContain(
      'data-redirect-to="/catalog',
    );
  });

  it('keeps anonymous catalog and worksheet routes available when disabled', () => {
    expect(renderRoute('/catalog', false)).toContain('Catalog page');
    expect(renderRoute('/worksheet', false)).toContain('Worksheet page');
  });

  it('redirects protected routes according to availability', () => {
    expect(renderRoute('/profile', true)).toContain(
      'data-redirect-to="/login"',
    );
    expect(renderRoute('/profile', false)).toContain(
      'data-redirect-to="/catalog',
    );
  });

  it('keeps authenticated protected routes available while public login is off', () => {
    expect(renderRoute('/profile', false, 'authenticated')).toContain(
      'Profile page',
    );
  });
});
