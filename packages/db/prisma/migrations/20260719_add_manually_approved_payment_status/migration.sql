-- Migration: add manually_approved to PaymentStatus enum
-- Adds a distinct status for human admin payment reviews, separate from
-- auto_approved (ML pipeline) so audit queries can distinguish the two.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'manually_approved' AFTER 'auto_approved';
