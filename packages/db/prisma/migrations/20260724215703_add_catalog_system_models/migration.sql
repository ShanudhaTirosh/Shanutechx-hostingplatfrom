-- Migration: Add catalog system models for Platform Admin & Catalog Management System
-- Adds VpsPlan, CustomDomain, StatusPageConfig, Incident, IncidentUpdate, 
-- MailAccount, TermsOfService, PrivacyPolicy models and extends Deployment model
-- with resource limit fields (cpuLimit, memoryLimit, storageLimit)

-- Add new enum values to CustomDomainStatus
ALTER TYPE "CustomDomainStatus" ADD VALUE IF NOT EXISTS 'ssl_provisioning';
ALTER TYPE "CustomDomainStatus" ADD VALUE IF NOT EXISTS 'active';

-- Create IncidentSeverity enum
CREATE TYPE "IncidentSeverity" AS ENUM ('informational', 'degraded_performance', 'partial_outage', 'full_outage');

-- Create IncidentStatus enum
CREATE TYPE "IncidentStatus" AS ENUM ('investigating', 'identified', 'monitoring', 'resolved');

-- Add resource limit fields to Deployment table
ALTER TABLE "Deployment" ADD COLUMN "cpuLimit" DOUBLE PRECISION;
ALTER TABLE "Deployment" ADD COLUMN "memoryLimit" INTEGER;
ALTER TABLE "Deployment" ADD COLUMN "storageLimit" INTEGER;

-- Create VpsPlan table
CREATE TABLE "VpsPlan" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bandwidth" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'monthly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leasewebProductCode" TEXT,

    CONSTRAINT "VpsPlan_pkey" PRIMARY KEY ("id")
);

-- Create CustomDomain table
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cnameTarget" TEXT NOT NULL,
    "status" "CustomDomainStatus" NOT NULL DEFAULT 'pending',
    "sslCertId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- Create StatusPageConfig table
CREATE TABLE "StatusPageConfig" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'ShanuTechX Platform',
    "logoUrl" TEXT,
    "uptimeKumaUrl" TEXT,
    "showUptimeMetrics" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPageConfig_pkey" PRIMARY KEY ("id")
);

-- Create Incident table
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "affectedServices" TEXT[],
    "status" "IncidentStatus" NOT NULL DEFAULT 'investigating',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- Create IncidentUpdate table
CREATE TABLE "IncidentUpdate" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- Create MailAccount table
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "quotaMb" INTEGER NOT NULL DEFAULT 1024,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- Create TermsOfService table
CREATE TABLE "TermsOfService" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactInfo" JSONB NOT NULL,

    CONSTRAINT "TermsOfService_pkey" PRIMARY KEY ("id")
);

-- Create PrivacyPolicy table
CREATE TABLE "PrivacyPolicy" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactInfo" JSONB NOT NULL,

    CONSTRAINT "PrivacyPolicy_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE UNIQUE INDEX "MailAccount_username_domain_key" ON "MailAccount"("username", "domain");

-- Create indexes
CREATE INDEX "CustomDomain_deploymentId_idx" ON "CustomDomain"("deploymentId");
CREATE INDEX "IncidentUpdate_incidentId_idx" ON "IncidentUpdate"("incidentId");

-- Add foreign key constraints
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
