import {
  createUcsdAuthResponse,
  type UcsdAuthHttpOptions,
} from '../../api/src/auth/ucsdAuth.response.js';

export function createWorkerAuthHandler(options: UcsdAuthHttpOptions) {
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
      const response = await createUcsdAuthResponse(
        {
          body,
          context: request,
          method: request.method,
          pathname: url.pathname,
          source: request.headers.get('cf-connecting-ip') ?? 'unknown',
        },
        options,
      );
      return (
        response ??
        Response.json(
          { error: 'NOT_FOUND' },
          { status: 404, headers: { 'cache-control': 'no-store' } },
        )
      );
    } catch {
      return Response.json(
        {
          error: 'AUTH_UNAVAILABLE',
          message: 'Authentication is temporarily unavailable.',
        },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
  };
}
