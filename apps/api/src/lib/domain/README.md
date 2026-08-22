# Domain Manager Module

Handles custom domain attachment, CNAME verification, SSL certificate provisioning, and Traefik routing configuration for deployments.

## Features

- **Custom Domain Attachment**: Attach custom domains to deployments with CNAME-based verification
- **DNS Verification**: Verify CNAME records resolve correctly using Cloudflare DNS-over-HTTPS
- **SSL Provisioning**: Automatically request SSL certificates from Cloudflare
- **Traefik Integration**: Configure dynamic routing with SSL and HTTPS enforcement
- **Certificate Management**: Track expiration and automate renewal
- **Multiple Domains**: Support multiple custom domains per deployment

## Usage

```typescript
import { domainManager } from './lib/domain';

// Attach a custom domain
const result = await domainManager.attachCustomDomain(
  'deployment-id',
  'app.example.com'
);
console.log(`CNAME Target: ${result.cnameTarget}`);

// Verify domain
const verification = await domainManager.verifyDomain(result.customDomainId);
if (verification.verified) {
  console.log('Domain verified and SSL provisioning started');
}

// Check certificate expiration
const expiringCerts = await domainManager.checkCertificateExpiration();
for (const cert of expiringCerts) {
  if (cert.requiresRenewal) {
    await domainManager.renewCertificate(cert.customDomainId);
  }
}
```

## Module Structure

- `manager.ts` - Main domain manager class with lifecycle methods
- `cname.ts` - CNAME target generation and validation utilities
- `index.ts` - Barrel export for clean imports

## Requirements Validation

**Requirements 4**: Custom Domain Attachment with CNAME
- 4.1: Accept fully qualified domain names
- 4.2: Generate unique CNAME targets
- 4.3: Instruct customers on DNS configuration
- 4.4: Verify CNAME records resolve correctly
- 4.5: Display instructions for correct DNS configuration
- 4.6: Configure Traefik routing on successful verification
- 4.7: Request SSL certificates from Cloudflare
- 4.8: Configure HTTPS traffic with SSL certificates
- 4.9: Support multiple custom domains per deployment
- 4.10: Make custom domains immediately active for routing

**Requirements 16**: Domain Verification and SSL Certificate Management
- 16.1: Request SSL certificates from Cloudflare after verification
- 16.2: Use Cloudflare API for certificate provisioning
- 16.3: Configure Traefik with issued certificates
- 16.4: Automatically renew certificates before expiration
- 16.5: Retry renewal on failure within 24 hours
- 16.6: Enforce HTTPS for all custom domain traffic
- 16.7: Redirect HTTP requests to HTTPS

## Error Handling

The module includes comprehensive error handling:
- `INVALID_DOMAIN_FORMAT`: Domain format validation failed
- `DEPLOYMENT_NOT_FOUND`: Deployment does not exist
- `DOMAIN_ALREADY_EXISTS`: Domain is already attached to another deployment
- `CUSTOM_DOMAIN_NOT_FOUND`: Custom domain record not found
- `DOMAIN_NOT_VERIFIED`: Domain must be verified before SSL provisioning
- `SSL_NOT_PROVISIONED`: SSL certificate not yet provisioned
- `NO_INTERNAL_PORT`: Deployment has no internal port configured
- `NO_SSL_CERTIFICATE`: No SSL certificate found for domain

## Dependencies

- **Cloudflare Client**: DNS verification and SSL certificate management
- **Traefik Config**: Dynamic routing configuration
- **Prisma**: Database operations for CustomDomain model
- **Logger**: Structured logging with pino

## Testing

Property-based tests for CNAME generation are located in:
- `tests/unit/cname-generation.property.test.ts`

The CNAME utilities in this module are extracted from the test file to ensure consistency between implementation and verification.
