import type { UcsdAuthStore } from './ucsdAuth.store.js';
import type { AppUserIdentity, VerificationRecord } from './ucsdIdentity.js';

export function createMemoryUcsdAuthStore(): UcsdAuthStore & {
  usersByEmail: Map<string, AppUserIdentity>;
} {
  const verifications: (VerificationRecord & {
    id: number;
    deliveryStatus: 'pending' | 'sent' | 'failed';
    consumedAt?: number;
  })[] = [];
  const usersByEmail = new Map<string, AppUserIdentity>();
  let nextUserId = 1;
  let nextVerificationId = 1;

  return {
    usersByEmail,
    reserveVerification(record, cooldownMs) {
      const [latest] = verifications
        .filter(
          (item) =>
            item.normalizedEmail === record.normalizedEmail &&
            ((item.deliveryStatus === 'sent' &&
              item.createdAt + cooldownMs > record.createdAt) ||
              (item.deliveryStatus === 'pending' &&
                item.expiresAt > record.createdAt)),
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      if (latest) {
        return Promise.resolve({
          status: 'blocked' as const,
          reason:
            latest.deliveryStatus === 'pending'
              ? ('pending' as const)
              : ('cooldown' as const),
          retryAt:
            latest.deliveryStatus === 'pending'
              ? latest.expiresAt
              : latest.createdAt + cooldownMs,
        });
      }
      const id = nextVerificationId++;
      verifications.push({ ...record, id, deliveryStatus: 'pending' });
      return Promise.resolve({
        status: 'created' as const,
        verificationId: id,
      });
    },
    markVerificationSent(verificationId) {
      const verification = verifications.find(
        (item) => item.id === verificationId,
      );
      if (!verification || verification.deliveryStatus !== 'pending') {
        return Promise.reject(
          new Error('Verification reservation is not pending'),
        );
      }
      verification.deliveryStatus = 'sent';
      return Promise.resolve();
    },
    markVerificationFailed(verificationId) {
      const verification = verifications.find(
        (item) => item.id === verificationId,
      );
      if (verification?.deliveryStatus === 'pending')
        verification.deliveryStatus = 'failed';
      return Promise.resolve();
    },
    consumeVerification(normalizedEmail, codeHash, now) {
      const verification = [...verifications]
        .reverse()
        .find(
          (item) =>
            item.normalizedEmail === normalizedEmail &&
            item.codeHash === codeHash &&
            item.deliveryStatus !== 'failed' &&
            !item.consumedAt &&
            item.expiresAt > now,
        );
      if (!verification) {
        const hasPriorCode = verifications.some(
          (item) =>
            item.normalizedEmail === normalizedEmail &&
            item.codeHash === codeHash &&
            item.deliveryStatus !== 'failed',
        );
        return Promise.resolve(
          hasPriorCode ? 'expired_or_consumed' : 'invalid',
        );
      }
      verification.consumedAt = now;
      verification.deliveryStatus = 'sent';
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
