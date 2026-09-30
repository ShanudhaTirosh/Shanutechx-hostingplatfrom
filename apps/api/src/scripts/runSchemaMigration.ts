import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { prisma } from '../lib/prisma';

async function main() {
  console.log('Applying database schema updates...');
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SupabaseClientProject" ADD COLUMN IF NOT EXISTS "nodeId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SupabaseClientProject" ADD COLUMN IF NOT EXISTS "nodeIp" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SupabaseClientProject" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NodePortExposure" (
      "id" TEXT NOT NULL,
      "nodeId" TEXT NOT NULL,
      "port" INTEGER NOT NULL,
      "protocol" TEXT NOT NULL DEFAULT 'http',
      "subdomain" TEXT NOT NULL,
      "cfDnsRecordId" TEXT,
      "label" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NodePortExposure_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NodePortExposure_subdomain_key') THEN
        ALTER TABLE "NodePortExposure" ADD CONSTRAINT "NodePortExposure_subdomain_key" UNIQUE ("subdomain");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NodePortExposure_nodeId_port_key') THEN
        ALTER TABLE "NodePortExposure" ADD CONSTRAINT "NodePortExposure_nodeId_port_key" UNIQUE ("nodeId", "port");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NodePortExposure_nodeId_fkey') THEN
        ALTER TABLE "NodePortExposure" ADD CONSTRAINT "NodePortExposure_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NodePortExposure_nodeId_idx" ON "NodePortExposure"("nodeId");
  `);

  console.log('Database schema migration applied successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
