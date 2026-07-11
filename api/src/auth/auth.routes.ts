import type express from 'express';

import { casLogin } from './auth.handlers.js';

export function registerLegacyCasRoute(app: express.Express): void {
  app.get('/api/auth/cas', casLogin);
}
