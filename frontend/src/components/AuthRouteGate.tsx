import { Navigate, Outlet, useLocation } from 'react-router-dom';

import Spinner from './Spinner';
import NeedsLogin from '../pages/NeedsLogin';
import { useStore } from '../store';
import { createCatalogLink } from '../utilities/navigation';
import {
  PUBLIC_LOGIN_ENABLED,
  resolvePublicLoginRoute,
} from '../utilities/publicLogin';

export default function AuthRouteGate() {
  const authStatus = useStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === 'loading') return <Spinner message="Authenticating..." />;
  if (authStatus === 'initializing')
    return <Spinner message="Fetching user info..." />;

  if (location.pathname === '/graphiql') {
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
    PUBLIC_LOGIN_ENABLED,
  );

  if (routeDecision.type === 'redirect') {
    const destination =
      routeDecision.to === '/catalog' ? createCatalogLink() : routeDecision.to;
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
