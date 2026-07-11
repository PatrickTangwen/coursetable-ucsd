import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import Spinner from './Spinner';
import NeedsLogin from '../pages/NeedsLogin';
import { useStore } from '../store';
import { createCatalogLink } from '../utilities/navigation';
import {
  PUBLIC_LOGIN_ENABLED,
  resolvePublicLoginRoute,
} from '../utilities/publicLogin';

function renderNavigate(to: string) {
  return <Navigate to={to} replace />;
}

export default function AuthRouteGate({
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
  renderRedirect = renderNavigate,
  authStatus: authStatusOverride,
}: {
  readonly publicLoginEnabled?: boolean;
  readonly renderRedirect?: (to: string) => ReactNode;
  readonly authStatus?:
    | 'loading'
    | 'initializing'
    | 'authenticated'
    | 'unauthenticated';
}) {
  const { authStatus: storeAuthStatus, user } = useStore(
    useShallow((state) => ({
      user: state.user,
      authStatus: state.authStatus,
    })),
  );
  const authStatus = authStatusOverride ?? storeAuthStatus;
  const location = useLocation();

  if (authStatus === 'loading') return <Spinner message="Authenticating..." />;
  if (authStatus === 'initializing')
    return <Spinner message="Fetching user info..." />;

  if (location.pathname === '/graphiql') {
    if (user?.hasEvals) return <Outlet />;
    return (
      <NeedsLogin
        redirect={location.pathname}
        message="the GraphQL interface"
      />
    );
  }

  const routeDecision = resolvePublicLoginRoute(
    location.pathname,
    authStatus === 'authenticated',
    publicLoginEnabled,
  );

  if (routeDecision.type === 'redirect') {
    const destination =
      routeDecision.to === '/catalog' ? createCatalogLink() : routeDecision.to;
    return renderRedirect(destination);
  }

  return <Outlet />;
}
