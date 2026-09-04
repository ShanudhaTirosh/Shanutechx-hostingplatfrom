-- Add nodeId and nodeIp to SupabaseClientProject
ALTER TABLE "SupabaseClientProject"
  ADD COLUMN IF NOT EXISTS "nodeId" TEXT,
  ADD COLUMN IF NOT EXISTS "nodeIp"  TEXT;

-- Create NodePortExposure table
CREATE TABLE IF NOT EXISTS "NodePortExposure" (
  "id"            TEXT NOT NULL,
  "nodeId"        TEXT NOT NULL,
  "port"          INTEGER NOT NULL,
  "protocol"      TEXT NOT NULL DEFAULT 'http',
  "subdomain"     TEXT NOT NULL,
  "cfDnsRecordId" TEXT,
  "label"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NodePortExposure_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "NodePortExposure"
  ADD CONSTRAINT "NodePortExposure_subdomain_key" UNIQUE ("subdomain");

ALTER TABLE "NodePortExposure"
  ADD CONSTRAINT "NodePortExposure_nodeId_port_key" UNIQUE ("nodeId", "port");

-- Index
CREATE INDEX IF NOT EXISTS "NodePortExposure_nodeId_idx" ON "NodePortExposure"("nodeId");

-- Foreign key to Node
ALTER TABLE "NodePortExposure"
  ADD CONSTRAINT "NodePortExposure_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
