/**
 * Cloudflare API client module
 * 
 * Provides DNS CNAME record management and SSL certificate provisioning
 * for custom domain attachment with automatic rate limit handling.
 */

export {
  CloudflareClient,
  cloudflareClient,
  CloudflareClientError,
  type DNSRecord,
  type SSLCertificate,
  type DNSVerificationResult,
  type SSLStatusResult,
} from './client';
