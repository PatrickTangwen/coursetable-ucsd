import type express from 'express';
import type { AppUserIdentity } from './ucsdIdentity.js';

export function getAppSessionUser(req: express.Request) {
  return req.session.appUser ?? null;
}

export function authAppUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (!getAppSessionUser(req)) {
    res.status(401).json({ error: 'USER_NOT_FOUND' });
    return;
  }
  next();
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

export async function establishAppSession(
  req: express.Request,
  user: AppUserIdentity,
) {
  await regenerateSession(req);
  req.session.appUser = user;
  await saveSession(req);
}
