import type { AppUserIdentity } from './ucsdIdentity.js';

export interface AppSession {
  destroy: (requestContext: unknown) => Promise<void>;
  establish: (requestContext: unknown, user: AppUserIdentity) => Promise<void>;
  getUser: (requestContext: unknown) => AppUserIdentity | null;
}
