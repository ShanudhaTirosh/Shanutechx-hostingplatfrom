/**
 * Cloudflare API client module
 * 
 * Provides DNS CNAME record management for custom domain attachment with
 * automatic rate limit handling. SSL is provided by Traefik + Let's Encrypt,
 * so no Cloudflare certificate-pack code is exposed here.
 */

export {
  CloudflareClient,
  cloudflareClient,
  CloudflareClientError,
  type DNSRecord,
  type DNSVerificationResult,
} from './client';
