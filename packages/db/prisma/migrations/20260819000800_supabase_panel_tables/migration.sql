-- Audit finding H1: persists the last four in-memory stores in
-- routes/supabase.ts (client projects, GoTrue/Auth SMTP config, auth
-- email templates, and SMTP delivery logs).

CREATE TABLE "SupabaseClientProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'ap-southeast-1 (Local)',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "anonKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "smtpConfigured" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupabaseClientProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupabaseAuthSmtpConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "user" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "enableEmailSignup" BOOLEAN NOT NULL DEFAULT true,
    "enableAutoconfirm" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupabaseAuthSmtpConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupabaseEmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,

    CONSTRAINT "SupabaseEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupabaseSmtpDeliveryLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "smtpHost" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupabaseSmtpDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupabaseSmtpDeliveryLog_createdAt_idx" ON "SupabaseSmtpDeliveryLog"("createdAt");

-- Seed data matching the old in-memory defaults, so behavior is
-- unchanged immediately after this migration runs.
INSERT INTO "SupabaseClientProject" ("id", "name", "clientEmail", "dbName", "region", "status", "anonKey", "serviceKey", "smtpConfigured", "createdAt") VALUES
  ('proj_default', 'ShanuTechX Core Platform', 'admin@shanutechx.com', 'postgres', 'ap-southeast-1 (Local)', 'ACTIVE', '', '', true, CURRENT_TIMESTAMP - INTERVAL '30 days');
-- anonKey/serviceKey are intentionally left blank here (not duplicated
-- from env) -- routes/supabase.ts fills the default project's keys from
-- SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY lazily on first read if
-- blank, so a fresh clone of this migration never bakes in stale keys.

INSERT INTO "SupabaseEmailTemplate" ("id", "name", "subject", "html") VALUES
  ('confirmation', 'Confirm Signup', 'Confirm your ShanuTechX Account', '<h2>Welcome to ShanuTechX!</h2><p>Please confirm your account by clicking the link below:</p><p><a href="{{ .ConfirmationURL }}">Confirm Account</a></p>'),
  ('recovery', 'Reset Password', 'Reset Your ShanuTechX Password', '<h2>Password Reset Request</h2><p>Click below to choose a new password:</p><p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>'),
  ('magic_link', 'Magic Link', 'Your Magic Link Sign In', '<h2>Passwordless Login</h2><p>Click to log in to ShanuTechX:</p><p><a href="{{ .ConfirmationURL }}">Log In Now</a></p>'),
  ('invite', 'User Invitation', 'You have been invited to ShanuTechX', '<h2>You are invited!</h2><p>An account has been created for you. Click to accept:</p><p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>');
