-- Phase 15 (Scoped Admin): admin no longer has blanket access to every
-- customer's resources — only customers explicitly delegated to them by
-- dev. See docs/CLAUDE.md "Phase 15" and packages/db/prisma/schema.prisma's
-- User.assignedAdminId doc comment.

ALTER TABLE "User" ADD COLUMN "assignedAdminId" TEXT;

CREATE INDEX "User_assignedAdminId_idx" ON "User"("assignedAdminId");

ALTER TABLE "User" ADD CONSTRAINT "User_assignedAdminId_fkey"
  FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
