-- Phase 5: optional webmail WebUI link per SMTP/mailbox account.
ALTER TABLE "SmtpAccount" ADD COLUMN "webmailUrl" TEXT;
