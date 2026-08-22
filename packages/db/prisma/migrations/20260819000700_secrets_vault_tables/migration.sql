-- Audit finding H1: persists the Secrets Vault (previously an in-memory
-- secretProjects Map + auditTrail array in routes/secrets.ts). Secret
-- values are stored encrypted (AES-256-GCM via lib/secretsVault.ts), not
-- in plaintext.

CREATE TABLE "SecretProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecretItem_projectId_key_key" ON "SecretItem"("projectId", "key");

ALTER TABLE "SecretItem" ADD CONSTRAINT "SecretItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "SecretProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SecretAuditEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "secretKey" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecretAuditEntry_projectId_idx" ON "SecretAuditEntry"("projectId");

ALTER TABLE "SecretAuditEntry" ADD CONSTRAINT "SecretAuditEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "SecretProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretAuditEntry" ADD CONSTRAINT "SecretAuditEntry_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
