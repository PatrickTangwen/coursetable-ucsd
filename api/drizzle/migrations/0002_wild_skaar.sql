CREATE TABLE IF NOT EXISTS "emailDeliveryAudits" (
	"normalizedRecipientEmail" varchar(256) NOT NULL,
	"requestId" varchar(256) PRIMARY KEY NOT NULL,
	"providerMessageId" varchar(256),
	"requestTime" bigint NOT NULL,
	"deliveryOutcome" varchar(32) NOT NULL,
	"expiresAt" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_delivery_audit_recipient_time_idx" ON "emailDeliveryAudits" ("normalizedRecipientEmail","requestTime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_delivery_audit_expiry_idx" ON "emailDeliveryAudits" ("expiresAt");