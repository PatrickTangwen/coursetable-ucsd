import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export interface UcsdAuthStore {
  reserveVerification: (
    record: VerificationRecord,
    cooldownMs: number,
  ) => Promise<
    | { status: 'created'; verificationId: number }
    | { status: 'blocked'; reason: 'cooldown' | 'pending'; retryAt: number }
  >;
  markVerificationSent: (verificationId: number) => Promise<void>;
  markVerificationFailed: (verificationId: number) => Promise<void>;
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
