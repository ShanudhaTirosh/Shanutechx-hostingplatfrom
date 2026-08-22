-- Migration: Phase 1 — manual-only payment review, Product/Plan catalog, Discord webhooks
--
-- This migration:
--   1. Adds reviewer/rejection-reason audit fields to Payment (manual review trail).
--   2. Makes OrderItem.serviceId nullable and adds a nullable planId, so both the
--      legacy Service-based checkout and the new Product/Plan-based checkout can
--      coexist during the transition (see scripts/migrate-services-to-products.ts).
--   3. Creates ProductCategory / PlanBillingType enums and the Product / Plan tables.
--   4. Creates NotificationEvent enum and the DiscordWebhookConfig table.
--   5. Creates the AiSubscriptionRequest table, linked 1:1 to OrderItem and 1:1 to Ticket.
--
-- Nothing here drops or renames an existing column/table. The legacy Service table
-- and ServiceType enum are left untouched and fully functional.

-- ── 1. Payment: manual-review audit fields ─────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. OrderItem: nullable serviceId + new nullable planId ─────────────────
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_serviceId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD COLUMN "planId" TEXT;

-- ── 3. Product / Plan catalog ───────────────────────────────────────────────
CREATE TYPE "ProductCategory" AS ENUM (
  'web_hosting',
  'node_app_hosting',
  'python_app_hosting',
  'discordbot_node',
  'discordbot_python',
  'whatsappbot_hosting',
  'lavalink_hosting',
  'vps',
  'ai_subscription',
  'smtp_hosting',
  'database_hosting',
  'app_catalog'
);

CREATE TYPE "PlanBillingType" AS ENUM (
  'one_time',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly'
);

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_category_isActive_idx" ON "Product"("category", "isActive");

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "billingType" "PlanBillingType" NOT NULL,
    "specsJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Plan_productId_isActive_idx" ON "Plan"("productId", "isActive");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Discord webhook configuration (infra-level, Dev Dashboard-managed) ──
CREATE TYPE "NotificationEvent" AS ENUM (
  'new_payment_submitted',
  'payment_approved',
  'payment_rejected',
  'new_order',
  'new_ticket',
  'deployment_failed',
  'vps_assigned',
  'new_ai_subscription_request'
);

CREATE TABLE "DiscordWebhookConfig" (
    "id" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordWebhookConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordWebhookConfig_event_isActive_idx" ON "DiscordWebhookConfig"("event", "isActive");

-- ── 5. AI subscription activation requests (popup -> auto ticket) ─────────
CREATE TABLE "AiSubscriptionRequest" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSubscriptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSubscriptionRequest_orderItemId_key" ON "AiSubscriptionRequest"("orderItemId");
CREATE UNIQUE INDEX "AiSubscriptionRequest_ticketId_key" ON "AiSubscriptionRequest"("ticketId");

ALTER TABLE "AiSubscriptionRequest" ADD CONSTRAINT "AiSubscriptionRequest_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiSubscriptionRequest" ADD CONSTRAINT "AiSubscriptionRequest_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
