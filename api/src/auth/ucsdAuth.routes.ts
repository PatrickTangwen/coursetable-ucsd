import type express from 'express';
import asyncHandler from 'express-async-handler';

import type { AppSession } from './appSession.js';
import {
  createUcsdAuthResponse,
  type AuthHttpSession,
  type UcsdAuthHttpOptions,
} from './ucsdAuth.response.js';
import { toAppUserResponse } from './ucsdIdentity.js';

export type UcsdAuthRoutesOptions = Omit<UcsdAuthHttpOptions, 'session'> & {
  requestSource?: (req: express.Request) => string;
  session: AppSession;
};

export function registerAuthCheckRoute(
  app: express.IRouter,
  session: AppSession,
): void {
  app.get('/api/auth/check', (req, res) => {
    const appUser = session.getUser(req);
    if (appUser) {
      res.json({
        auth: true,
        netId: null,
        user: toAppUserResponse(appUser),
      });
    } else if (req.user) {
      res.json({ auth: true, netId: req.user.netId, user: req.user });
    } else {
      res.json({ auth: false, netId: null, user: null });
    }
  });
}

export function registerUcsdAuthRoutes(
  app: express.IRouter,
  {
    session,
    requestSource = (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
    ...auth
  }: UcsdAuthRoutesOptions,
): void {
  const httpSession = createExpressAuthHttpSession(session);
  const handler = asyncHandler(async (req, res) => {
    const response = await createUcsdAuthResponse(
      {
        body: req.body,
        context: { req, res },
        method: req.method,
        pathname: req.path,
        source: requestSource(req),
      },
      { ...auth, session: httpSession },
    );
    if (!response) {
      res.sendStatus(404);
      return;
    }
    for (const [name, value] of response.headers)
      if (name !== 'content-type') res.setHeader(name, value);
    if (response.body === null) {
      res.sendStatus(response.status);
      return;
    }
    res.status(response.status).json(await response.json());
  });

  app.get('/api/auth/current-user', handler);
  app.post('/api/auth/ucsd/request-verification', handler);
  app.post('/api/auth/ucsd/verify', handler);
  app.post('/api/auth/logout', handler);
}

function createExpressAuthHttpSession(session: AppSession): AuthHttpSession {
  const context = (value: unknown) =>
    value as { req: express.Request; res: express.Response };
  return {
    getUser: (value) => Promise.resolve(session.getUser(context(value).req)),
    establish: (value, user) => session.establish(context(value).req, user),
    async destroy(value) {
      const { req, res } = context(value);
      res.clearCookie('connect.sid');
      await session.destroy(req);
    },
  };
}
