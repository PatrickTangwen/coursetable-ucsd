import crypto from 'node:crypto';

export interface AppUserIdentity {
  user_id: number;
  verified_email: string;
}

export interface VerificationRecord {
  normalizedEmail: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
}

export const verificationCodeTtlMs = 15 * 60 * 1000;

export function normalizeVerifiedUcsdEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain, ...rest] = normalized.split('@');
  if (!localPart || domain !== 'ucsd.edu' || rest.length > 0) return null;
  return normalized;
}

export function createVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashVerificationCode(normalizedEmail: string, code: string) {
  return crypto
    .createHash('sha256')
    .update(`${normalizedEmail}:${code}`)
    .digest('hex');
}

export function toAppUserResponse(user: AppUserIdentity) {
  return {
    user_id: user.user_id,
    verified_email: user.verified_email,
  };
}

export function appUserIdToLegacyNetId(userId: number) {
  return `u${userId.toString(36).padStart(7, '0').slice(-7)}`;
}
