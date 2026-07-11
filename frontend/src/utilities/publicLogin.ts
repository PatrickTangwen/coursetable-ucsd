export function parsePublicLoginEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export const PUBLIC_LOGIN_ENABLED = parsePublicLoginEnabled(
  import.meta.env.VITE_PUBLIC_LOGIN_ENABLED,
);

export type PublicLoginRouteDecision = 'allow' | 'catalog' | 'login';

export function resolvePublicLoginRoute(
  pathname: string,
  authenticated: boolean,
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
): PublicLoginRouteDecision {
  if (pathname === '/catalog' || pathname === '/worksheet') return 'allow';

  if (pathname === '/login') {
    if (authenticated || !publicLoginEnabled) return 'catalog';
    return 'allow';
  }

  if (authenticated) return 'allow';
  return publicLoginEnabled ? 'login' : 'catalog';
}

export function shouldShowPublicLoginEntry(
  authenticated: boolean,
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
): boolean {
  return authenticated || publicLoginEnabled;
}
