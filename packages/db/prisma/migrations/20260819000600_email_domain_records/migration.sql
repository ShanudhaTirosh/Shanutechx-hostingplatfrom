-- Audit finding H1: persists custom email domain verification records
-- (previously an in-memory Map in routes/email.ts, reset on every
-- restart).

CREATE TABLE "EmailDomain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "smtpAccountId" TEXT,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_dns',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDomain_domain_key" ON "EmailDomain"("domain");
CREATE INDEX "EmailDomain_userId_idx" ON "EmailDomain"("userId");

ALTER TABLE "EmailDomain" ADD CONSTRAINT "EmailDomain_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
