import type { UcsdAuthStore } from './ucsdAuth.store.js';
import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export function createMemoryUcsdAuthStore(): UcsdAuthStore & {
  usersByEmail: Map<string, AppUserIdentity>;
} {
  const verifications: (VerificationRecord & { consumedAt?: number })[] = [];
  const usersByEmail = new Map<string, AppUserIdentity>();
  let nextUserId = 1;

  return {
    usersByEmail,
    createVerification(record) {
      verifications.push(record);
      return Promise.resolve();
    },
    consumeVerification(normalizedEmail, codeHash, now) {
      const verification = [...verifications]
        .reverse()
        .find(
          (item) =>
            item.normalizedEmail === normalizedEmail &&
            item.codeHash === codeHash &&
            !item.consumedAt &&
            item.expiresAt > now,
        );
      if (!verification) return Promise.resolve(false);
      verification.consumedAt = now;
      return Promise.resolve(true);
    },
    findOrCreateUser(normalizedEmail) {
      const existing = usersByEmail.get(normalizedEmail);
      if (existing) return Promise.resolve(existing);
      const user = {
        user_id: nextUserId++,
        verified_email: normalizedEmail,
      };
      usersByEmail.set(normalizedEmail, user);
      return Promise.resolve(user);
    },
  };
}
