import {
  createUcsdAuthResponse,
  type UcsdAuthHttpOptions,
} from '../../api/src/auth/ucsdAuth.response.js';
import {
  createPlanningDataResponse,
  type PlanningDataHttpOptions,
} from '../../api/src/planningData/planningData.response.js';

interface WorkerAppBackendOptions {
  auth: UcsdAuthHttpOptions;
  planningData: PlanningDataHttpOptions;
}

export function createWorkerAppBackendHandler(
  options: WorkerAppBackendOptions,
) {
  return async (request: Request) => {
    const url = new URL(request.url);
    let body: unknown = undefined;
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }

    try {
      const authResponse = await createUcsdAuthResponse(
        {
          body,
          context: request,
          method: request.method,
          pathname: url.pathname,
          source: request.headers.get('cf-connecting-ip') ?? 'unknown',
        },
        options.auth,
      );
      if (authResponse) return authResponse;

      const planningResponse = await createPlanningDataResponse(
        {
          body,
          context: request,
          method: request.method,
          pathname: url.pathname,
          query: Object.fromEntries(url.searchParams),
        },
        options.planningData,
      );
      return (
        planningResponse ??
        Response.json(
          { error: 'NOT_FOUND' },
          { status: 404, headers: { 'cache-control': 'no-store' } },
        )
      );
    } catch {
      return unavailableResponse(url.pathname);
    }
  };
}

export function unavailableResponse(pathname: string) {
  const auth = pathname === '/api/auth' || pathname.startsWith('/api/auth/');
  return Response.json(
    auth
      ? {
          error: 'AUTH_UNAVAILABLE',
          message: 'Authentication is temporarily unavailable.',
        }
      : {
          error: 'ACCOUNT_DATA_UNAVAILABLE',
          message: 'Account data is temporarily unavailable.',
        },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}
