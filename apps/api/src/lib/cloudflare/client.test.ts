import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareClient, CloudflareClientError } from './client';

describe('CloudflareClient', () => {
  let client: CloudflareClient;
  const mockApiToken = 'test-token-123';
  const mockZoneId = 'test-zone-456';

  beforeEach(() => {
    client = new CloudflareClient(mockApiToken, mockZoneId);
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a client with provided credentials', () => {
      expect(client).toBeInstanceOf(CloudflareClient);
    });
  });

  describe('Error handling', () => {
    it('should create CloudflareClientError with all properties', () => {
      const error = new CloudflareClientError('Test error', 403, { detail: 'test' });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(403);
      expect(error.responseBody).toEqual({ detail: 'test' });
      expect(error.name).toBe('CloudflareClientError');
    });
  });

  describe('createCNAME', () => {
    it('should format CNAME creation request correctly', async () => {
      const mockResponse = {
        success: true,
        result: {
          id: 'record-123',
          type: 'CNAME',
          name: 'app.example.com',
          content: 'deployment.platform.shanutechx.com',
          proxied: false,
          ttl: 300,
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createCNAME(
        'app.example.com',
        'deployment.platform.shanutechx.com'
      );

      expect(result).toEqual(mockResponse.result);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/zones/${mockZoneId}/dns_records`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiToken}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            type: 'CNAME',
            name: 'app.example.com',
            content: 'deployment.platform.shanutechx.com',
            proxied: false,
            ttl: 300,
          }),
        })
      );
    });

    it('should handle rate limiting with exponential backoff', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ success: false, errors: [{ message: 'Rate limited' }] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: {
              id: 'record-123',
              type: 'CNAME',
              name: 'app.example.com',
              content: 'target.example.com',
              proxied: false,
              ttl: 300,
              created_on: '2024-01-01T00:00:00Z',
              modified_on: '2024-01-01T00:00:00Z',
            },
          }),
        };
      });

      const result = await client.createCNAME('app.example.com', 'target.example.com');

      expect(callCount).toBe(2);
      expect(result.id).toBe('record-123');
    });

    it('should throw error on 401 unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          errors: [{ message: 'Invalid token' }],
        }),
      });

      await expect(client.createCNAME('app.example.com', 'target.example.com')).rejects.toThrow(
        CloudflareClientError
      );
      await expect(client.createCNAME('app.example.com', 'target.example.com')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should throw error on 403 forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          errors: [{ message: 'Insufficient permissions' }],
        }),
      });

      await expect(client.createCNAME('app.example.com', 'target.example.com')).rejects.toThrow(
        CloudflareClientError
      );
      await expect(client.createCNAME('app.example.com', 'target.example.com')).rejects.toThrow(
        'Forbidden'
      );
    });
  });

  describe('verifyDNS', () => {
    it('should verify DNS record exists and return resolved target', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          Answer: [
            {
              type: 5, // CNAME
              data: 'deployment.platform.shanutechx.com.',
            },
          ],
        }),
      });

      const result = await client.verifyDNS('app.example.com');

      expect(result.verified).toBe(true);
      expect(result.resolvedTarget).toBe('deployment.platform.shanutechx.com');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://1.1.1.1/dns-query?name=app.example.com&type=CNAME',
        expect.objectContaining({
          headers: { Accept: 'application/dns-json' },
        })
      );
    });

    it('should return not verified when CNAME not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          Answer: [],
        }),
      });

      const result = await client.verifyDNS('app.example.com');

      expect(result.verified).toBe(false);
      expect(result.resolvedTarget).toBe('');
    });

    it('should handle DNS query failure gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.verifyDNS('app.example.com');

      expect(result.verified).toBe(false);
      expect(result.resolvedTarget).toBe('');
    });
  });

  describe('requestSSL', () => {
    it('should request SSL certificate for domain', async () => {
      const mockResponse = {
        success: true,
        result: {
          id: 'cert-123',
          type: 'advanced',
          method: 'txt',
          status: 'pending' as const,
          hosts: ['app.example.com'],
          expires_on: '2024-04-01T00:00:00Z',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.requestSSL('app.example.com');

      expect(result.status).toBe('pending');
      expect(result.hosts).toEqual(['app.example.com']);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/zones/${mockZoneId}/ssl/certificate_packs/order`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'advanced',
            hosts: ['app.example.com'],
            validation_method: 'txt',
            validity_days: 90,
            certificate_authority: 'lets_encrypt',
          }),
        })
      );
    });
  });

  describe('getSSLStatus', () => {
    it('should get SSL certificate status', async () => {
      const mockResponse = {
        success: true,
        result: {
          id: 'cert-123',
          type: 'advanced',
          method: 'txt',
          status: 'active' as const,
          hosts: ['app.example.com'],
          expires_on: '2024-04-01T00:00:00Z',
          issued_on: '2024-01-01T00:00:00Z',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getSSLStatus('cert-123');

      expect(result.status).toBe('active');
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/zones/${mockZoneId}/ssl/certificate_packs/cert-123`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('renewSSL', () => {
    it('should renew SSL certificate', async () => {
      const getCurrentResponse = {
        success: true,
        result: {
          id: 'cert-123',
          type: 'advanced',
          method: 'txt',
          status: 'active' as const,
          hosts: ['app.example.com'],
          expires_on: '2024-04-01T00:00:00Z',
        },
      };

      const renewResponse = {
        success: true,
        result: {
          id: 'cert-456',
          type: 'advanced',
          method: 'txt',
          status: 'pending' as const,
          hosts: ['app.example.com'],
          expires_on: '2024-07-01T00:00:00Z',
        },
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => getCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => renewResponse,
        });

      const result = await client.renewSSL('cert-123');

      expect(result.id).toBe('cert-456');
      expect(result.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
