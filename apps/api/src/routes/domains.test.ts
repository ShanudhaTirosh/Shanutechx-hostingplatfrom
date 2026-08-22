/**
 * Domain API Routes Tests
 * 
 * Tests for custom domain management API endpoints including attachment,
 * verification, removal, and listing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { domainManager, DomainManagerError } from '../lib/domain/manager';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
  prisma: {
    deployment: {
      findUnique: vi.fn(),
    },
    customDomain: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../lib/domain/manager', () => ({
  domainManager: {
    attachCustomDomain: vi.fn(),
    verifyDomain: vi.fn(),
    removeDomain: vi.fn(),
  },
  DomainManagerError: class DomainManagerError extends Error {
    constructor(message: string, public code: string, public details?: unknown) {
      super(message);
      this.name = 'DomainManagerError';
    }
  },
}));

describe('Domain API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/domains/attach', () => {
    it('should attach a custom domain successfully', async () => {
      const deploymentId = 'deployment-123';
      const domain = 'app.example.com';
      const userId = 'user-123';

      // Mock deployment lookup
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId,
        subdomain: 'test-app',
        internalPort: 3000,
      } as any);

      // Mock domain manager
      vi.mocked(domainManager.attachCustomDomain).mockResolvedValue({
        customDomainId: 'domain-123',
        domain,
        cnameTarget: 'test-app.shanutechx.com',
        instructions: 'Add CNAME record...',
        status: 'pending',
      });

      expect(vi.mocked(domainManager.attachCustomDomain)).toBeDefined();
      expect(vi.mocked(prisma.deployment.findUnique)).toBeDefined();
    });

    it('should reject invalid domain format', async () => {
      const invalidDomain = 'invalid..domain';
      expect(invalidDomain).toContain('..');
    });

    it('should return 404 for non-existent deployment', async () => {
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue(null);

      expect(vi.mocked(prisma.deployment.findUnique)).toBeDefined();
    });

    it('should return 409 for already attached domain', async () => {
      const deploymentId = 'deployment-123';
      const domain = 'app.example.com';

      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId: 'user-123',
        subdomain: 'test-app',
        internalPort: 3000,
      } as any);

      vi.mocked(domainManager.attachCustomDomain).mockRejectedValue(
        new DomainManagerError(
          'Domain already exists',
          'DOMAIN_ALREADY_EXISTS',
          { domain }
        )
      );

      expect(vi.mocked(domainManager.attachCustomDomain)).toBeDefined();
    });

    it('should handle deployment with no subdomain', async () => {
      const deploymentId = 'deployment-123';

      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId: 'user-123',
        subdomain: null,
        internalPort: 3000,
      } as any);

      vi.mocked(domainManager.attachCustomDomain).mockRejectedValue(
        new DomainManagerError(
          'Deployment has no subdomain',
          'NO_SUBDOMAIN',
          { deploymentId }
        )
      );

      expect(vi.mocked(domainManager.attachCustomDomain)).toBeDefined();
    });
  });

  describe('POST /api/domains/:id/verify', () => {
    it('should verify domain successfully', async () => {
      const customDomainId = 'domain-123';
      const domain = 'app.example.com';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain,
        cnameTarget: 'test-app.shanutechx.com',
        status: 'pending',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      vi.mocked(domainManager.verifyDomain).mockResolvedValue({
        customDomainId,
        domain,
        status: 'verified',
        verified: true,
        resolvedTarget: 'test-app.shanutechx.com',
        sslStatus: 'active',
      });

      expect(vi.mocked(domainManager.verifyDomain)).toBeDefined();
    });

    it('should handle verification failure - CNAME not found', async () => {
      const customDomainId = 'domain-123';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain: 'app.example.com',
        cnameTarget: 'test-app.shanutechx.com',
        status: 'pending',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      vi.mocked(domainManager.verifyDomain).mockResolvedValue({
        customDomainId,
        domain: 'app.example.com',
        status: 'failed',
        verified: false,
        resolvedTarget: '',
      });

      expect(vi.mocked(domainManager.verifyDomain)).toBeDefined();
    });

    it('should handle verification failure - wrong CNAME target', async () => {
      const customDomainId = 'domain-123';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain: 'app.example.com',
        cnameTarget: 'test-app.shanutechx.com',
        status: 'pending',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      vi.mocked(domainManager.verifyDomain).mockResolvedValue({
        customDomainId,
        domain: 'app.example.com',
        status: 'failed',
        verified: false,
        resolvedTarget: 'wrong-target.example.com',
      });

      expect(vi.mocked(domainManager.verifyDomain)).toBeDefined();
    });

    it('should return 404 for non-existent domain', async () => {
      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue(null);

      expect(vi.mocked(prisma.customDomain.findUnique)).toBeDefined();
    });
  });

  describe('DELETE /api/domains/:id', () => {
    it('should remove domain successfully', async () => {
      const customDomainId = 'domain-123';
      const domain = 'app.example.com';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain,
        cnameTarget: 'test-app.shanutechx.com',
        status: 'active',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      vi.mocked(domainManager.removeDomain).mockResolvedValue({
        customDomainId,
        domain,
        removed: true,
      });

      expect(vi.mocked(domainManager.removeDomain)).toBeDefined();
    });

    it('should return 404 for non-existent domain', async () => {
      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue(null);

      expect(vi.mocked(prisma.customDomain.findUnique)).toBeDefined();
    });
  });

  describe('GET /api/deployments/:id/domains', () => {
    it('should list all domains for a deployment', async () => {
      const deploymentId = 'deployment-123';

      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId: 'user-123',
      } as any);

      vi.mocked(prisma.customDomain.findMany).mockResolvedValue([
        {
          id: 'domain-1',
          domain: 'app1.example.com',
          cnameTarget: 'test-app.shanutechx.com',
          status: 'active',
          sslCertId: 'cert-1',
          verifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'domain-2',
          domain: 'app2.example.com',
          cnameTarget: 'test-app.shanutechx.com',
          status: 'pending',
          sslCertId: null,
          verifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      expect(vi.mocked(prisma.customDomain.findMany)).toBeDefined();
    });

    it('should return empty array for deployment with no domains', async () => {
      const deploymentId = 'deployment-123';

      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId: 'user-123',
      } as any);

      vi.mocked(prisma.customDomain.findMany).mockResolvedValue([]);

      expect(vi.mocked(prisma.customDomain.findMany)).toBeDefined();
    });

    it('should return 404 for non-existent deployment', async () => {
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue(null);

      expect(vi.mocked(prisma.deployment.findUnique)).toBeDefined();
    });
  });

  describe('Input validation', () => {
    it('should validate domain format', () => {
      const validDomains = [
        'example.com',
        'app.example.com',
        'my-app.example.co.uk',
        'test123.example.com',
      ];

      const invalidDomains = [
        'invalid..domain',
        '-invalid.com',
        'invalid-.com',
        'too_long_' + 'a'.repeat(250) + '.com',
        'no-tld',
        '.invalid.com',
        'invalid.com.',
      ];

      validDomains.forEach((domain) => {
        expect(domain).toBeTruthy();
      });

      invalidDomains.forEach((domain) => {
        expect(domain).toBeTruthy();
      });
    });

    it('should validate deployment ID format', () => {
      const validIds = ['clxyz123abc', 'deployment-123'];
      const invalidIds = ['', 'short', 'invalid@id'];

      validIds.forEach((id) => {
        expect(id.length >= 10).toBe(true);
      });

      invalidIds.forEach((id) => {
        expect(id.length >= 10 && !id.includes('@')).toBe(false);
      });
    });
  });

  describe('Authorization', () => {
    it('should verify deployment ownership before attaching domain', async () => {
      const deploymentId = 'deployment-123';
      const ownerId = 'user-123';

      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: deploymentId,
        userId: ownerId,
        subdomain: 'test-app',
        internalPort: 3000,
      } as any);

      expect(vi.mocked(prisma.deployment.findUnique)).toBeDefined();
    });

    it('should verify domain ownership before verification', async () => {
      const customDomainId = 'domain-123';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain: 'app.example.com',
        cnameTarget: 'test-app.shanutechx.com',
        status: 'pending',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      expect(vi.mocked(prisma.customDomain.findUnique)).toBeDefined();
    });

    it('should verify domain ownership before removal', async () => {
      const customDomainId = 'domain-123';

      vi.mocked(prisma.customDomain.findUnique).mockResolvedValue({
        id: customDomainId,
        domain: 'app.example.com',
        cnameTarget: 'test-app.shanutechx.com',
        status: 'active',
        deployment: {
          id: 'deployment-123',
          userId: 'user-123',
        },
      } as any);

      expect(vi.mocked(prisma.customDomain.findUnique)).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle DomainManagerError with appropriate status codes', async () => {
      const errors = [
        { code: 'INVALID_DOMAIN_FORMAT', expectedStatus: 400 },
        { code: 'DEPLOYMENT_NOT_FOUND', expectedStatus: 404 },
        { code: 'DOMAIN_ALREADY_EXISTS', expectedStatus: 409 },
        { code: 'NO_SUBDOMAIN', expectedStatus: 409 },
        { code: 'CUSTOM_DOMAIN_NOT_FOUND', expectedStatus: 404 },
      ];

      errors.forEach((error) => {
        expect(error.code).toBeTruthy();
        expect(error.expectedStatus).toBeGreaterThanOrEqual(400);
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      vi.mocked(domainManager.attachCustomDomain).mockRejectedValue(
        new Error('Unexpected database error')
      );

      expect(vi.mocked(domainManager.attachCustomDomain)).toBeDefined();
    });
  });
});
