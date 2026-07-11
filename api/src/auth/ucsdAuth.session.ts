import type express from 'express';
import type { AppSession } from './appSession.js';
import type { AppUserIdentity } from './ucsdIdentity.js';

function getAppSessionUser(req: express.Request) {
  return req.session.appUser ?? null;
}

export function createAuthAppUser(session: AppSession) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void => {
    if (!session.getUser(req)) {
      res.status(401).json({ error: 'USER_NOT_FOUND' });
      return;
    }
    next();
  };
}

function regenerateSession(req: express.Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function saveSession(req: express.Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function establishAppSession(
  req: express.Request,
  user: AppUserIdentity,
) {
  await regenerateSession(req);
  req.session.appUser = user;
  await saveSession(req);
}

function destroyAppSession(req: express.Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export const expressAppSession: AppSession = {
  destroy: (context) => destroyAppSession(context as express.Request),
  establish: (context, user) =>
    establishAppSession(context as express.Request, user),
  getUser: (context) => getAppSessionUser(context as express.Request),
};
