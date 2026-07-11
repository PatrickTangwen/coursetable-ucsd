import type { UcsdAuthStore } from './ucsdAuth.store.js';
import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export function createMemoryUcsdAuthStore(): UcsdAuthStore & {
  usersByEmail: Map<string, AppUserIdentity>;
} {
  const verifications: (VerificationRecord & {
    id: number;
    consumedAt?: number;
  })[] = [];
  const usersByEmail = new Map<string, AppUserIdentity>();
  let nextUserId = 1;
  let nextVerificationId = 1;

  return {
    usersByEmail,
    reserveVerification(record, cooldownMs) {
      const [latest] = verifications
        .filter((item) => item.normalizedEmail === record.normalizedEmail)
        .sort((a, b) => b.createdAt - a.createdAt);
      if (latest && latest.createdAt + cooldownMs > record.createdAt) {
        return Promise.resolve({
          status: 'cooldown' as const,
          retryAt: latest.createdAt + cooldownMs,
        });
      }
      const id = nextVerificationId++;
      verifications.push({ ...record, id });
      return Promise.resolve({
        status: 'created' as const,
        verificationId: id,
      });
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
      if (!verification) {
        const hasPriorCode = verifications.some(
          (item) =>
            item.normalizedEmail === normalizedEmail &&
            item.codeHash === codeHash,
        );
        return Promise.resolve(
          hasPriorCode ? 'expired_or_consumed' : 'invalid',
        );
      }
      verification.consumedAt = now;
      return Promise.resolve('consumed');
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
