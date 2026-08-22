import { env } from '../../env';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Cloudflare API client error class
 */
export class CloudflareClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'CloudflareClientError';
  }
}

/**
 * DNS Record response from Cloudflare API
 */
export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  created_on: string;
  modified_on: string;
}

/**
 * SSL Certificate response from Cloudflare API
 */
export interface SSLCertificate {
  id: string;
  type: string;
  method: string;
  status: 'pending' | 'active' | 'expired';
  hosts: string[];
  expires_on: string;
  issued_on?: string;
}

/**
 * DNS verification result
 */
export interface DNSVerificationResult {
  verified: boolean;
  resolvedTarget: string;
}

/**
 * SSL certificate status result
 */
export interface SSLStatusResult {
  status: 'pending' | 'active' | 'expired';
}

/**
 * Cloudflare API client for DNS and SSL management
 * 
 * Implements DNS CNAME record creation/verification and SSL certificate
 * management with automatic rate limit handling using exponential backoff.
 */
export class CloudflareClient {
  private readonly apiToken: string;
  private readonly zoneId: string;

  constructor(apiToken?: string, zoneId?: string) {
    this.apiToken = apiToken ?? env.cloudflareApiToken;
    this.zoneId = zoneId ?? env.cloudflareZoneId;
  }

  /**
   * Get standard headers for Cloudflare API requests
   */
  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make API request with exponential backoff for rate limit handling
   * Retry delays: 1s, 2s, 4s, 8s, 16s
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    maxRetries = 5
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Parse response body
        const data: any = await response.json();

        // Handle authentication errors
        if (response.status === 401) {
          throw new CloudflareClientError(
            'Unauthorized: Invalid Cloudflare API token',
            401,
            data
          );
        }

        // Handle forbidden errors
        if (response.status === 403) {
          throw new CloudflareClientError(
            'Forbidden: API token lacks required permissions',
            403,
            data
          );
        }

        // Handle other errors
        if (!response.ok) {
          const errorMessage = this.extractErrorMessage(data);
          throw new CloudflareClientError(
            `Cloudflare API error: ${errorMessage}`,
            response.status,
            data
          );
        }

        // Check Cloudflare-specific success field
        if ('success' in data && !data.success) {
          const errorMessage = this.extractErrorMessage(data);
          throw new CloudflareClientError(
            `Cloudflare API request failed: ${errorMessage}`,
            response.status,
            data
          );
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on non-rate-limit errors
        if (error instanceof CloudflareClientError && error.statusCode !== 429) {
          throw error;
        }
        
        // If this was the last attempt, throw
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
        
        // For network errors, apply backoff before retrying
        if (!(error instanceof CloudflareClientError)) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries reached');
  }

  /**
   * Extract error message from Cloudflare API response
   */
  private extractErrorMessage(data: any): string {
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((e: any) => e.message).join('; ');
    }
    return 'Unknown error';
  }

  /**
   * Create a DNS CNAME record for a custom domain
   * 
   * @param domain - The fully qualified domain name (e.g., "app.example.com")
   * @param target - The CNAME target (e.g., "deployment-id.platform.shanutechx.com")
   * @returns The created DNS record
   */
  async createCNAME(domain: string, target: string): Promise<DNSRecord> {
    const url = `${CF_API_BASE}/zones/${this.zoneId}/dns_records`;
    
    const response = await this.fetchWithRetry<{
      success: boolean;
      result: DNSRecord;
      errors?: Array<{ message: string }>;
    }>(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        type: 'CNAME',
        name: domain,
        content: target,
        proxied: false, // Not proxied - platform Traefik handles TLS
        ttl: 300, // 5 minutes
      }),
    });

    return response.result;
  }

  /**
   * Verify that a DNS record exists and resolves correctly
   * 
   * Uses DNS-over-HTTPS to verify the CNAME record
   * 
   * @param domain - The fully qualified domain name to verify
   * @returns Verification result with status and resolved target
   */
  async verifyDNS(domain: string): Promise<DNSVerificationResult> {
    try {
      // Use DNS-over-HTTPS for verification (Cloudflare's 1.1.1.1)
      const dnsUrl = `https://1.1.1.1/dns-query?name=${domain}&type=CNAME`;
      const response = await fetch(dnsUrl, {
        headers: { Accept: 'application/dns-json' },
      });

      if (!response.ok) {
        return { verified: false, resolvedTarget: '' };
      }

      const dnsData: any = await response.json();

      // Check if we got a CNAME answer
      if (dnsData.Answer && Array.isArray(dnsData.Answer)) {
        const cnameRecord = dnsData.Answer.find((record: any) => record.type === 5); // 5 = CNAME
        
        if (cnameRecord && cnameRecord.data) {
          // Remove trailing dot if present
          const resolvedTarget = cnameRecord.data.replace(/\.$/, '');
          return {
            verified: true,
            resolvedTarget,
          };
        }
      }

      return { verified: false, resolvedTarget: '' };
    } catch (error) {
      // DNS verification failed
      return { verified: false, resolvedTarget: '' };
    }
  }

  /**
   * Request an SSL certificate for a domain
   * 
   * Uses Cloudflare's Universal SSL or Advanced Certificate Manager
   * 
   * @param domain - The fully qualified domain name
   * @returns The requested SSL certificate
   */
  async requestSSL(domain: string): Promise<SSLCertificate> {
    const url = `${CF_API_BASE}/zones/${this.zoneId}/ssl/certificate_packs/order`;
    
    const response = await this.fetchWithRetry<{
      success: boolean;
      result: SSLCertificate;
      errors?: Array<{ message: string }>;
    }>(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        type: 'advanced',
        hosts: [domain],
        validation_method: 'txt',
        validity_days: 90,
        certificate_authority: 'lets_encrypt',
      }),
    });

    return response.result;
  }

  /**
   * Get the status of an SSL certificate
   * 
   * @param certificateId - The certificate ID from Cloudflare
   * @returns Certificate status information
   */
  async getSSLStatus(certificateId: string): Promise<SSLStatusResult> {
    const url = `${CF_API_BASE}/zones/${this.zoneId}/ssl/certificate_packs/${certificateId}`;
    
    const response = await this.fetchWithRetry<{
      success: boolean;
      result: SSLCertificate;
      errors?: Array<{ message: string }>;
    }>(url, {
      method: 'GET',
      headers: this.headers(),
    });

    return {
      status: response.result.status,
    };
  }

  /**
   * Renew an SSL certificate
   * 
   * @param certificateId - The certificate ID to renew
   * @returns The renewed SSL certificate
   */
  async renewSSL(certificateId: string): Promise<SSLCertificate> {
    // First, get the current certificate details
    const currentCert = await this.fetchWithRetry<{
      success: boolean;
      result: SSLCertificate;
    }>(`${CF_API_BASE}/zones/${this.zoneId}/ssl/certificate_packs/${certificateId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    // Request a new certificate with the same hosts
    const url = `${CF_API_BASE}/zones/${this.zoneId}/ssl/certificate_packs/order`;
    
    const response = await this.fetchWithRetry<{
      success: boolean;
      result: SSLCertificate;
      errors?: Array<{ message: string }>;
    }>(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        type: currentCert.result.type,
        hosts: currentCert.result.hosts,
        validation_method: currentCert.result.method,
        validity_days: 90,
        certificate_authority: 'lets_encrypt',
      }),
    });

    return response.result;
  }
}

/**
 * Default Cloudflare client instance using environment variables
 */
export const cloudflareClient = new CloudflareClient();
