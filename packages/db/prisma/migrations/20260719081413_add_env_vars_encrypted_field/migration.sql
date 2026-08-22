-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "envVarsEncrypted" TEXT;

-- Add comment
COMMENT ON COLUMN "Deployment"."envVarsEncrypted" IS 'Encrypted JSON string of environment variables for deployment (Requirements 12.10-12.11)';
