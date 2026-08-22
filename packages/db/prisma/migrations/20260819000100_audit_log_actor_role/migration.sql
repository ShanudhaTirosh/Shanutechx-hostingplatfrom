-- Adds a nullable actor-role marker to AuditLog so customer self-service
-- actions (e.g. VPS password reset via routes/leaseweb.ts) can be
-- distinguished from genuine staff actions in the admin audit trail.
-- See audit finding H9 -- previously every row was implicitly assumed to
-- be a staff action, which mislabeled customer self-service events.
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" TEXT;
