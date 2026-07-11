import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export interface UcsdAuthStore {
  reserveVerification: (
    record: VerificationRecord,
    cooldownMs: number,
  ) => Promise<
    | { status: 'created'; verificationId: number }
    | { status: 'cooldown'; retryAt: number }
  >;
  consumeVerification: (
    normalizedEmail: string,
    codeHash: string,
    now: number,
  ) => Promise<'consumed' | 'invalid' | 'expired_or_consumed'>;
  findOrCreateUser: (
    normalizedEmail: string,
    now: number,
  ) => Promise<AppUserIdentity>;
}
