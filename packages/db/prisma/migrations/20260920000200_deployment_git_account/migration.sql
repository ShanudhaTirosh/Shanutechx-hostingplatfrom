-- Remember which connected Git account a deployment pulls with, so a fresh short-lived
-- token can be minted at build time instead of being persisted inside "repoUrl".
ALTER TABLE "Deployment"
  ADD COLUMN IF NOT EXISTS "gitAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "gitProvider"  TEXT;
