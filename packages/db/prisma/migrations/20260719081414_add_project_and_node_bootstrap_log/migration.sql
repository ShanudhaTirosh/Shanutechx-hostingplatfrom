-- Adds the Project and NodeBootstrapLog tables.
--
-- CRITICAL FIX: these two models have existed in schema.prisma since at
-- least the "add_catalog_system_models" migration (they're used throughout
-- the Database Studio / Dev Dashboard code), but NEITHER ever had a
-- corresponding CREATE TABLE in any committed migration file — they were
-- evidently only ever applied to a real database via `prisma db push`
-- during development, which updates the database directly without writing
-- a migration. That meant a fresh `prisma migrate deploy` against a clean
-- database (exactly what you'd run to set up a new environment, or what
-- CI would run) would fail with "relation Project does not exist" the
-- moment any code touched it. Found by actually applying every migration
-- in order against a real Postgres instance — not by code review.

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "dbUsername" TEXT NOT NULL,
    "dbPassword" TEXT NOT NULL,
    "apiPort" INTEGER,
    "containerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NodeBootstrapLog" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeBootstrapLog_pkey" PRIMARY KEY ("id")
);
