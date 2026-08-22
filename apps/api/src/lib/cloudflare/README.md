# Cloudflare API Client

Cloudflare API client for DNS CNAME record management and SSL certificate provisioning for custom domain attachment.

## Features

- **DNS CNAME Management**: Create and verify CNAME records for custom domains
- **SSL Certificate Management**: Request, monitor, and renew SSL certificates
- **Automatic Rate Limit Handling**: Exponential backoff retry (1s, 2s, 4s, 8s, 16s)
- **Error Handling**: Descriptive errors for 401 (unauthorized), 403 (forbidden), and 429 (rate limit)

## Environment Variables

```bash
# API token with DNS:Edit and SSL/TLS:Edit permissions
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"

# Zone ID for the platform domain (found in Cloudflare dashboard)
CLOUDFLARE_ZONE_ID="your-cloudflare-zone-id"
```

## Usage

### Basic Usage

```typescript
import { cloudflareClient } from './lib/cloudflare';

// Create CNAME record
const record = await cloudflareClient.createCNAME(
  'app.example.com',
  'deployment-123.platform.shanutechx.com'
);

// Verify DNS record
const verification = await cloudflareClient.verifyDNS('app.example.com');
if (verification.verified) {
  console.log('CNAME points to:', verification.resolvedTarget);
}

// Request SSL certificate
const certificate = await cloudflareClient.requestSSL('app.example.com');
console.log('Certificate ID:', certificate.id);
console.log('Status:', certificate.status);

// Check certificate status
const status = await cloudflareClient.getSSLStatus(certificate.id);
console.log('Current status:', status.status);

// Renew certificate
const renewed = await cloudflareClient.renewSSL(certificate.id);
console.log('Renewed certificate ID:', renewed.id);
```

### Custom Client Instance

```typescript
import { CloudflareClient } from './lib/cloudflare';

// Create client with custom credentials
const client = new CloudflareClient(
  'custom-api-token',
  'custom-zone-id'
);

// Use custom client
const record = await client.createCNAME('test.example.com', 'target.example.com');
```

### Error Handling

```typescript
import { CloudflareClientError } from './lib/cloudflare';

try {
  await cloudflareClient.createCNAME('app.example.com', 'target.example.com');
} catch (error) {
  if (error instanceof CloudflareClientError) {
    console.error('Cloudflare API error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Response body:', error.responseBody);
  }
}
```

## API Reference

### `cloudflareClient.createCNAME(domain, target)`

Creates a DNS CNAME record for a custom domain.

**Parameters:**
- `domain` (string): The fully qualified domain name (e.g., "app.example.com")
- `target` (string): The CNAME target (e.g., "deployment-id.platform.shanutechx.com")

**Returns:** `Promise<DNSRecord>`

**Example:**
```typescript
const record = await cloudflareClient.createCNAME(
  'app.example.com',
  'deployment-123.platform.shanutechx.com'
);
// { id: 'record-123', type: 'CNAME', name: 'app.example.com', content: 'deployment-123...', ... }
```

---

### `cloudflareClient.verifyDNS(domain)`

Verifies that a DNS record exists and resolves correctly using DNS-over-HTTPS.

**Parameters:**
- `domain` (string): The fully qualified domain name to verify

**Returns:** `Promise<DNSVerificationResult>`

**Example:**
```typescript
const result = await cloudflareClient.verifyDNS('app.example.com');
// { verified: true, resolvedTarget: 'deployment-123.platform.shanutechx.com' }
```

---

### `cloudflareClient.requestSSL(domain)`

Requests an SSL certificate for a domain using Let's Encrypt via Cloudflare.

**Parameters:**
- `domain` (string): The fully qualified domain name

**Returns:** `Promise<SSLCertificate>`

**Example:**
```typescript
const cert = await cloudflareClient.requestSSL('app.example.com');
// { id: 'cert-123', status: 'pending', hosts: ['app.example.com'], expires_on: '...', ... }
```

---

### `cloudflareClient.getSSLStatus(certificateId)`

Gets the current status of an SSL certificate.

**Parameters:**
- `certificateId` (string): The certificate ID from Cloudflare

**Returns:** `Promise<SSLStatusResult>`

**Example:**
```typescript
const status = await cloudflareClient.getSSLStatus('cert-123');
// { status: 'active' }
```

---

### `cloudflareClient.renewSSL(certificateId)`

Renews an SSL certificate before expiration.

**Parameters:**
- `certificateId` (string): The certificate ID to renew

**Returns:** `Promise<SSLCertificate>`

**Example:**
```typescript
const renewed = await cloudflareClient.renewSSL('cert-123');
// { id: 'cert-456', status: 'pending', hosts: ['app.example.com'], ... }
```

## Types

### `DNSRecord`

```typescript
interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  created_on: string;
  modified_on: string;
}
```

### `SSLCertificate`

```typescript
interface SSLCertificate {
  id: string;
  type: string;
  method: string;
  status: 'pending' | 'active' | 'expired';
  hosts: string[];
  expires_on: string;
  issued_on?: string;
}
```

### `DNSVerificationResult`

```typescript
interface DNSVerificationResult {
  verified: boolean;
  resolvedTarget: string;
}
```

### `SSLStatusResult`

```typescript
interface SSLStatusResult {
  status: 'pending' | 'active' | 'expired';
}
```

## Rate Limiting

The client automatically handles Cloudflare API rate limits (HTTP 429) with exponential backoff:

1. First retry: 1 second
2. Second retry: 2 seconds
3. Third retry: 4 seconds
4. Fourth retry: 8 seconds
5. Fifth retry: 16 seconds

After 5 attempts, the request will fail with the last error.

## Testing

Run tests with:

```bash
npm test -- cloudflare/client.test.ts
```

## Integration Example

Complete custom domain attachment flow:

```typescript
import { cloudflareClient } from './lib/cloudflare';

async function attachCustomDomain(deploymentId: string, customDomain: string) {
  try {
    // 1. Generate CNAME target
    const cnameTarget = `${deploymentId}.platform.${env.rootDomain}`;
    
    // 2. Instruct customer to create CNAME record
    console.log(`Please create a CNAME record:`);
    console.log(`  Name: ${customDomain}`);
    console.log(`  Target: ${cnameTarget}`);
    
    // 3. Wait for customer confirmation, then verify DNS
    const verification = await cloudflareClient.verifyDNS(customDomain);
    if (!verification.verified) {
      throw new Error('DNS verification failed - CNAME not found');
    }
    
    if (verification.resolvedTarget !== cnameTarget) {
      throw new Error(
        `CNAME points to wrong target: ${verification.resolvedTarget} (expected: ${cnameTarget})`
      );
    }
    
    // 4. Request SSL certificate
    const certificate = await cloudflareClient.requestSSL(customDomain);
    console.log('SSL certificate requested:', certificate.id);
    
    // 5. Wait for certificate to become active
    let status = await cloudflareClient.getSSLStatus(certificate.id);
    while (status.status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      status = await cloudflareClient.getSSLStatus(certificate.id);
    }
    
    if (status.status !== 'active') {
      throw new Error('SSL certificate provisioning failed');
    }
    
    // 6. Configure Traefik routing for custom domain
    // (Implementation depends on Traefik configuration method)
    
    console.log('Custom domain attached successfully!');
    return { success: true, certificateId: certificate.id };
  } catch (error) {
    console.error('Failed to attach custom domain:', error);
    throw error;
  }
}
```
