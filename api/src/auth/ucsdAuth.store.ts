import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export interface UcsdAuthStore {
  createVerification: (record: VerificationRecord) => Promise<void>;
  consumeVerification: (
    normalizedEmail: string,
    codeHash: string,
    now: number,
  ) => Promise<boolean>;
  findOrCreateUser: (
    normalizedEmail: string,
    now: number,
  ) => Promise<AppUserIdentity>;
}
