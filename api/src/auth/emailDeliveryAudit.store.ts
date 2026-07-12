export const emailDeliveryAuditRetentionMs = 7 * 24 * 60 * 60 * 1000;

export const emailDeliveryAuditRecordFields = [
  'normalizedRecipientEmail',
  'requestId',
  'providerMessageId',
  'requestTime',
  'deliveryOutcome',
  'expiresAt',
] as const;

export const emailDeliveryOutcomes = [
  'requested',
  'sent',
  'definitive_failure',
  'ambiguous',
] as const;

export type EmailDeliveryOutcome = (typeof emailDeliveryOutcomes)[number];

export interface EmailDeliveryAuditRecord {
  normalizedRecipientEmail: string;
  requestId: string;
  providerMessageId: string | null;
  requestTime: number;
  deliveryOutcome: EmailDeliveryOutcome;
  expiresAt: number;
}

export interface EmailDeliveryAuditStore {
  recordRequest: (record: EmailDeliveryAuditRecord) => Promise<void>;
  recordOutcome: (
    requestId: string,
    outcome: Exclude<EmailDeliveryOutcome, 'requested'>,
    providerMessageId: string | null,
  ) => Promise<void>;
  findRecentByRecipient: (
    normalizedRecipientEmail: string,
    now: number,
  ) => Promise<EmailDeliveryAuditRecord[]>;
  deleteExpired: (now: number) => Promise<number>;
}

export function allowlistedEmailDeliveryAuditRecord(
  record: EmailDeliveryAuditRecord,
): EmailDeliveryAuditRecord {
  if (record.expiresAt !== record.requestTime + emailDeliveryAuditRetentionMs)
    throw new Error('Email Delivery Audit must expire after seven days');
  if (record.deliveryOutcome !== 'requested')
    throw new Error('Email Delivery Audit request must start as requested');
  if (record.providerMessageId !== null)
    throw new Error('Email Delivery Audit request cannot have a provider ID');
  if (
    record.normalizedRecipientEmail !==
    record.normalizedRecipientEmail.trim().toLowerCase()
  )
    throw new Error('Email Delivery Audit recipient must be normalized');

  return {
    normalizedRecipientEmail: record.normalizedRecipientEmail,
    requestId: record.requestId,
    providerMessageId: null,
    requestTime: record.requestTime,
    deliveryOutcome: 'requested',
    expiresAt: record.expiresAt,
  };
}

export function parseEmailDeliveryOutcome(value: string) {
  const outcome = emailDeliveryOutcomes.find(
    (candidate) => candidate === value,
  );
  if (!outcome) throw new Error('Email Delivery Audit has an invalid outcome');
  return outcome;
}
