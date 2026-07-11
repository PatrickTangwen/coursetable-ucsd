import type express from 'express';

import { casLogin } from './auth.handlers.js';
import {
  registerUcsdAuthRoutes,
  type UcsdAuthRoutesOptions,
} from './ucsdAuth.routes.js';
import { getAppSessionUser } from './ucsdAuth.session.js';
import { toAppUserResponse } from './ucsdIdentity.js';

export default (
  app: express.Express,
  options?: UcsdAuthRoutesOptions,
  registerLegacyCas = false,
): void => {
  app.get('/api/auth/check', (req, res) => {
    const appUser = getAppSessionUser(req);
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

  if (options) registerUcsdAuthRoutes(app, options);

  if (registerLegacyCas) app.get('/api/auth/cas', casLogin);
};
