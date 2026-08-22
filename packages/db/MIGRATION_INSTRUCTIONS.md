# Catalog System Database Migration Instructions

## What Was Done

The following models have been successfully added to the Prisma schema (`packages/db/prisma/schema.prisma`):

### New Models Created

1. **VpsPlan** - VPS plans for customer browsing and provisioning
   - Fields: provider, name, bandwidth, category, cpuCores, ramGb, storageGb, price, currency, billingPeriod, isActive, leasewebProductCode

2. **CustomDomain** - Custom domain management with CNAME verification and SSL
   - Fields: deploymentId, domain, cnameTarget, status, sslCertId, verifiedAt
   - Relation: Links to Deployment (one-to-many)

3. **StatusPageConfig** - Status page configuration
   - Fields: platformName, logoUrl, uptimeKumaUrl, showUptimeMetrics

4. **Incident** - Incidents for the public status page
   - Fields: title, description, severity, affectedServices, status, resolvedAt, resolution
   - New enums: IncidentSeverity, IncidentStatus

5. **IncidentUpdate** - Incident updates for status page
   - Fields: incidentId, description
   - Relation: Links to Incident (one-to-many)

6. **MailAccount** - Mail server accounts for mail server UI
   - Fields: username, domain, quotaMb

7. **TermsOfService** - Terms of service page content
   - Fields: content, lastUpdated, contactInfo

8. **PrivacyPolicy** - Privacy policy page content
   - Fields: content, lastUpdated, contactInfo

### Extended Models

- **Deployment** - Added resource limit fields:
  - `cpuLimit` (Float) - CPU cores limit
  - `memoryLimit` (Int) - Memory in MB
  - `storageLimit` (Int) - Storage in GB
  - `customDomains` (Relation) - One-to-many relationship with CustomDomain

- **CustomDomainStatus** enum - Added new values:
  - `ssl_provisioning`
  - `active`

### Migration File

A migration file has been created at:
```
packages/db/prisma/migrations/20260724215703_add_catalog_system_models/migration.sql
```

### Prisma Client

The Prisma client has been successfully generated with the new models.

## How to Apply the Migration

Since Docker was not running during task execution, the migration was created but not applied to the database. Follow these steps to apply it:

### Option 1: Using Docker Compose (Recommended)

1. Start the database using Docker Compose:
   ```bash
   cd infra/control-plane
   docker-compose up -d postgres
   ```

2. Wait for the database to be ready, then apply the migration:
   ```bash
   cd packages/db
   npx prisma migrate deploy
   ```

### Option 2: Manual Migration Application

If the database is already running elsewhere:

```bash
cd packages/db
npx prisma migrate deploy
```

### Option 3: Development Mode (Creates and Applies)

If you're in development and the database is running:

```bash
cd packages/db
npx prisma migrate dev
```

## Verification

After applying the migration, verify it was successful:

```bash
cd packages/db
npx prisma studio
```

This will open Prisma Studio where you can see all the new tables.

## Requirements Satisfied

This task implements the following requirements:

- **Requirement 1.1, 1.2**: Catalog item management infrastructure
- **Requirement 2.1, 2.2**: VPS plan management
- **Requirement 7.1**: Terms of service page
- **Requirement 8.1**: Privacy policy page
- **Requirement 9.1**: Public status page with incident management
- **Requirement 10.1**: Mail account management infrastructure

## Next Steps

After applying the migration, you can:

1. Start implementing the API endpoints for catalog management
2. Create the catalog manager service to parse template YAML files
3. Implement the domain manager service for custom domain attachment
4. Build the UI components for browsing and managing catalog items
