export function parsePublicLoginEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export const PUBLIC_LOGIN_ENABLED = parsePublicLoginEnabled(
  import.meta.env.VITE_PUBLIC_LOGIN_ENABLED,
);

export type PublicLoginRouteDecision =
  | { type: 'allow' }
  | { type: 'redirect'; to: '/catalog' | '/login' };

export function resolvePublicLoginRoute(
  pathname: string,
  authenticated: boolean,
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
): PublicLoginRouteDecision {
  if (pathname === '/catalog' || pathname === '/worksheet')
    return { type: 'allow' };

  if (pathname === '/login') {
    if (authenticated || !publicLoginEnabled)
      return { type: 'redirect', to: '/catalog' };
    return { type: 'allow' };
  }

  if (authenticated) return { type: 'allow' };
  return {
    type: 'redirect',
    to: publicLoginEnabled ? '/login' : '/catalog',
  };
}

export function shouldShowPublicLoginEntry(
  authenticated: boolean,
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
): boolean {
  return authenticated || publicLoginEnabled;
}
