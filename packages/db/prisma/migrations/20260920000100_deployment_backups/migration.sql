-- Per-deployment backups stored on GitHub (Releases API). Self-contained: plain TEXT
-- status/trigger columns, no dependency on the BackupStatus enum.

CREATE TABLE IF NOT EXISTS "DeploymentBackup" (
  "id"           TEXT NOT NULL,
  "deploymentId" TEXT NOT NULL,
  "trigger"      TEXT NOT NULL DEFAULT 'manual',
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "phase"        TEXT,
  "repoFullName" TEXT,
  "releaseId"    TEXT,
  "releaseTag"   TEXT,
  "releaseUrl"   TEXT,
  "components"   JSONB,
  "sizeBytes"    BIGINT,
  "error"        TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "restoreStatus" TEXT,
  "restorePhase"  TEXT,
  "restoreError"  TEXT,
  "restoreStartedAt" TIMESTAMP(3),
  "restoredAt"    TIMESTAMP(3),

  CONSTRAINT "DeploymentBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeploymentBackup_deploymentId_createdAt_idx" ON "DeploymentBackup"("deploymentId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeploymentBackup_status_idx" ON "DeploymentBackup"("status");

ALTER TABLE "DeploymentBackup"
  ADD CONSTRAINT "DeploymentBackup_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DeploymentBackupPolicy" (
  "deploymentId"        TEXT NOT NULL,
  "enabled"             BOOLEAN NOT NULL DEFAULT false,
  "intervalHours"       INTEGER NOT NULL DEFAULT 24,
  "retention"           INTEGER NOT NULL DEFAULT 7,
  "lastRunAt"           TIMESTAMP(3),
  "nextRunAt"           TIMESTAMP(3),
  "lastStatus"          TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeploymentBackupPolicy_pkey" PRIMARY KEY ("deploymentId")
);

CREATE INDEX IF NOT EXISTS "DeploymentBackupPolicy_enabled_nextRunAt_idx" ON "DeploymentBackupPolicy"("enabled", "nextRunAt");

ALTER TABLE "DeploymentBackupPolicy"
  ADD CONSTRAINT "DeploymentBackupPolicy_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
