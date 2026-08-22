-- Audit finding H1: persists the platform-wide outbound SMTP config
-- (previously an in-memory `globalSmtpConfig` variable, reset to
-- env-var/hardcoded defaults on every restart) and per-account custom
-- domain + alias list (previously an in-memory `accountDetailsStore`
-- Map, reset to empty on every restart).

ALTER TABLE "SmtpAccount" ADD COLUMN "customDomain" TEXT;
ALTER TABLE "SmtpAccount" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "SmtpAccount" ADD COLUMN "planTier" TEXT NOT NULL DEFAULT 'pro';

CREATE TABLE "PlatformSmtpConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "user" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT NOT NULL DEFAULT 'ShanuTechX Cloud Mailer',
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSmtpConfig_pkey" PRIMARY KEY ("id")
);

-- No seed row is inserted here deliberately -- routes/smtp.ts creates the
-- single "global" row lazily (upsert) the first time it's read or
-- written, using env.secretsEncryptionKey to encrypt the initial
-- password (a migration can't call application encryption code).
