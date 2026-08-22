-- Phase 4 completion: backup history log + per-project R2 bucket tracking.

ALTER TABLE "Project" ADD COLUMN "r2BucketName" TEXT;

CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "r2Key" TEXT,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);
