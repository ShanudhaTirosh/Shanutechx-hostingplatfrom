-- Phase 3: add 'terminated' to VpsProvisionStatus, reached only via the
-- admin/dev-only POST /leaseweb/instances/:kind/:id/terminate route.
ALTER TYPE "VpsProvisionStatus" ADD VALUE 'terminated';
