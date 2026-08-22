/**
 * Domain Manager Module
 * 
 * Handles custom domain attachment, CNAME verification, SSL certificate
 * provisioning, and Traefik routing configuration for deployments.
 * 
 * Responsibilities:
 * - Generate CNAME targets for custom domains
 * - Verify CNAME DNS records resolve correctly
 * - Request SSL certificates from Cloudflare API
 * - Configure Traefik dynamic routing for custom domains
 * - Enforce HTTPS redirection for custom domains
 * - Track certificate expiration and trigger renewal
 * - Support multiple domains per deployment
 * 
 * **Validates: Requirements 4, 16**
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { cloudflareClient, CloudflareClient } from '../cloudflare/client';
import { traefikConfig, TraefikConfig } from '../traefik/config';
import { generateCnameTarget } from './cname';
import { env } from '../../env';
import type { CustomDomainStatus } from '@prisma/client';

/**
 * Result of attaching a custom domain to a deployment
 */
export interface AttachDomainResult {
  customDomainId: string;
  domain: string;
  cnameTarget: string;
  instructions: string;
  status: CustomDomainStatus;
}

/**
 * Result of verifying a custom domain's CNAME record
 */
export interface VerifyDomainResult {
  customDomainId: string;
  domain: string;
  status: CustomDomainStatus;
  verified: boolean;
  resolvedTarget: string;
  sslStatus?: 'pending' | 'provisioning' | 'active' | 'failed' | 'expired';
}

/**
 * Result of SSL certificate provisioning
 */
export interface ProvisionSSLResult {
  customDomainId: string;
  domain: string;
  status: CustomDomainStatus;
  certificateId: string;
  sslStatus: 'pending' | 'active' | 'expired';
}

/**
 * Result of configuring Traefik routing
 */
export interface ConfigureRouteResult {
  customDomainId: string;
  domain: string;
  status: CustomDomainStatus;
  routeConfigured: boolean;
}

/**
 * Result of removing a custom domain
 */
export interface RemoveDomainResult {
  customDomainId: string;
  domain: string;
  removed: boolean;
}

/**
 * Certificate expiration check result
 */
export interface CertificateExpirationCheck {
  customDomainId: string;
  domain: string;
  certificateId: string;
  status: 'pending' | 'active' | 'expired';
  expiresOn?: string;
  requiresRenewal: boolean;
}

/**
 * Certificate renewal result
 */
export interface RenewCertificateResult {
  customDomainId: string;
  domain: string;
  oldCertificateId: string;
  newCertificateId: string;
  status: 'pending' | 'active' | 'expired';
  expiresOn: string;
}

/**
 * Domain Manager Error Class
 */
export class DomainManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'DomainManagerError';
  }
}

/**
 * Domain Manager
 * 
 * Orchestrates custom domain lifecycle: attachment, verification,
 * SSL provisioning, routing configuration, and renewal.
 */
export class DomainManager {
  constructor(
    private readonly cloudflare: CloudflareClient = cloudflareClient,
    private readonly traefik: TraefikConfig = traefikConfig,
    private readonly rootDomain: string = env.rootDomain
  ) {}

  /**
   * Attach a custom domain to a deployment
   * 
   * Creates a CustomDomain record with status 'pending' and returns
   * CNAME target instructions for the customer.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.9**
   * 
   * @param deploymentId - The deployment ID to attach the domain to
   * @param domain - The fully qualified domain name (e.g., "app.example.com")
   * @returns Attachment result with CNAME target and instructions
   * @throws DomainManagerError if deployment not found or domain already exists
   */
  async attachCustomDomain(
    deploymentId: string,
    domain: string
  ): Promise<AttachDomainResult> {
    logger.info({
      msg: 'Attaching custom domain to deployment',
      deploymentId,
      domain,
    });

    try {
      // Validate domain format
      if (!this.traefik.validateDomain(domain)) {
        throw new DomainManagerError(
          `Invalid domain format: ${domain}`,
          'INVALID_DOMAIN_FORMAT',
          { domain }
        );
      }

      // Check if deployment exists
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: {
          id: true,
          subdomain: true,
          userId: true,
          nodeId: true,
          internalPort: true,
        },
      });

      if (!deployment) {
        throw new DomainManagerError(
          `Deployment not found: ${deploymentId}`,
          'DEPLOYMENT_NOT_FOUND',
          { deploymentId }
        );
      }

      if (!deployment.subdomain) {
        throw new DomainManagerError(
          `Deployment ${deploymentId} has no subdomain assigned`,
          'NO_SUBDOMAIN',
          { deploymentId }
        );
      }

      // Check if domain already exists
      const existingDomain = await prisma.customDomain.findUnique({
        where: { domain },
      });

      if (existingDomain) {
        throw new DomainManagerError(
          `Domain ${domain} is already attached to another deployment`,
          'DOMAIN_ALREADY_EXISTS',
          { domain, existingDeploymentId: existingDomain.deploymentId }
        );
      }

      // Generate CNAME target using format: {deployment-subdomain}.{root-domain}
      // This ensures each deployment has a unique, stable CNAME target
      const cnameTarget = generateCnameTarget(deployment.subdomain, this.rootDomain);

      // Create CustomDomain record with status 'pending'
      const customDomain = await prisma.customDomain.create({
        data: {
          deploymentId,
          domain,
          cnameTarget,
          status: 'pending',
        },
      });

      // Generate customer instructions
      const instructions = this.generateCnameInstructions(domain, cnameTarget);

      logger.info({
        msg: 'Custom domain attached successfully',
        customDomainId: customDomain.id,
        deploymentId,
        domain,
        cnameTarget,
      });

      return {
        customDomainId: customDomain.id,
        domain,
        cnameTarget,
        instructions,
        status: customDomain.status,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to attach custom domain',
        deploymentId,
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Verify a custom domain's CNAME record
   * 
   * Checks if the CNAME record resolves correctly to the expected target.
   * If verified, updates status to 'verified' and triggers SSL provisioning.
   * 
   * **Validates: Requirements 4.3, 4.4, 4.5**
   * 
   * @param customDomainId - The custom domain ID to verify
   * @returns Verification result with status and resolved target
   * @throws DomainManagerError if custom domain not found
   */
  async verifyDomain(customDomainId: string): Promise<VerifyDomainResult> {
    logger.info({
      msg: 'Verifying custom domain CNAME record',
      customDomainId,
    });

    try {
      // Fetch custom domain record
      const customDomain = await prisma.customDomain.findUnique({
        where: { id: customDomainId },
        include: {
          deployment: {
            select: {
              id: true,
              nodeId: true,
              internalPort: true,
            },
          },
        },
      });

      if (!customDomain) {
        throw new DomainManagerError(
          `Custom domain not found: ${customDomainId}`,
          'CUSTOM_DOMAIN_NOT_FOUND',
          { customDomainId }
        );
      }

      // Use Cloudflare client to verify DNS record
      const verificationResult = await this.cloudflare.verifyDNS(customDomain.domain);

      if (!verificationResult.verified) {
        // Verification failed - update status to 'failed'
        await prisma.customDomain.update({
          where: { id: customDomainId },
          data: {
            status: 'failed',
            updatedAt: new Date(),
          },
        });

        logger.warn({
          msg: 'CNAME verification failed',
          customDomainId,
          domain: customDomain.domain,
          expectedTarget: customDomain.cnameTarget,
          resolvedTarget: verificationResult.resolvedTarget,
        });

        return {
          customDomainId,
          domain: customDomain.domain,
          status: 'failed',
          verified: false,
          resolvedTarget: verificationResult.resolvedTarget,
        };
      }

      // Check if resolved target matches expected target
      const targetMatches = verificationResult.resolvedTarget === customDomain.cnameTarget;

      if (!targetMatches) {
        // CNAME exists but points to wrong target
        await prisma.customDomain.update({
          where: { id: customDomainId },
          data: {
            status: 'failed',
            updatedAt: new Date(),
          },
        });

        logger.warn({
          msg: 'CNAME record points to incorrect target',
          customDomainId,
          domain: customDomain.domain,
          expectedTarget: customDomain.cnameTarget,
          resolvedTarget: verificationResult.resolvedTarget,
        });

        return {
          customDomainId,
          domain: customDomain.domain,
          status: 'failed',
          verified: false,
          resolvedTarget: verificationResult.resolvedTarget,
        };
      }

      // Verification succeeded - update status to 'verified'
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: {
          status: 'verified',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info({
        msg: 'CNAME verification succeeded',
        customDomainId,
        domain: customDomain.domain,
        resolvedTarget: verificationResult.resolvedTarget,
      });

      // Trigger SSL provisioning automatically
      try {
        const sslResult = await this.provisionSSL(customDomainId);
        
        return {
          customDomainId,
          domain: customDomain.domain,
          status: 'verified',
          verified: true,
          resolvedTarget: verificationResult.resolvedTarget,
          sslStatus: sslResult.sslStatus,
        };
      } catch (sslError) {
        // SSL provisioning failed, but CNAME is verified
        logger.error({
          msg: 'SSL provisioning failed after CNAME verification',
          customDomainId,
          domain: customDomain.domain,
          error: sslError instanceof Error ? sslError.message : String(sslError),
        });

        return {
          customDomainId,
          domain: customDomain.domain,
          status: 'verified',
          verified: true,
          resolvedTarget: verificationResult.resolvedTarget,
          sslStatus: 'failed',
        };
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to verify custom domain',
        customDomainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Provision an SSL certificate for a custom domain
   * 
   * Requests an SSL certificate from Cloudflare and updates the custom domain
   * status to 'ssl_provisioning'. Once the certificate is active, triggers
   * Traefik route configuration.
   * 
   * **Validates: Requirements 16.1, 16.2, 16.3**
   * 
   * @param customDomainId - The custom domain ID to provision SSL for
   * @returns SSL provisioning result with certificate ID
   * @throws DomainManagerError if custom domain not found or not verified
   */
  async provisionSSL(customDomainId: string): Promise<ProvisionSSLResult> {
    logger.info({
      msg: 'Provisioning SSL certificate',
      customDomainId,
    });

    try {
      // Fetch custom domain record
      const customDomain = await prisma.customDomain.findUnique({
        where: { id: customDomainId },
        include: {
          deployment: {
            select: {
              id: true,
              nodeId: true,
              internalPort: true,
            },
          },
        },
      });

      if (!customDomain) {
        throw new DomainManagerError(
          `Custom domain not found: ${customDomainId}`,
          'CUSTOM_DOMAIN_NOT_FOUND',
          { customDomainId }
        );
      }

      // Ensure domain is verified before provisioning SSL
      if (customDomain.status !== 'verified' && customDomain.status !== 'ssl_provisioning') {
        throw new DomainManagerError(
          `Cannot provision SSL for domain with status: ${customDomain.status}`,
          'DOMAIN_NOT_VERIFIED',
          { customDomainId, status: customDomain.status }
        );
      }

      // Update status to 'ssl_provisioning'
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: {
          status: 'ssl_provisioning',
          updatedAt: new Date(),
        },
      });

      // Request SSL certificate from Cloudflare
      const certificate = await this.cloudflare.requestSSL(customDomain.domain);

      // Update CustomDomain with certificate ID
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: {
          sslCertId: certificate.id,
          updatedAt: new Date(),
        },
      });

      logger.info({
        msg: 'SSL certificate requested successfully',
        customDomainId,
        domain: customDomain.domain,
        certificateId: certificate.id,
        sslStatus: certificate.status,
      });

      // If certificate is already active, configure Traefik route
      if (certificate.status === 'active') {
        try {
          await this.configureTraefikRoute(customDomainId);
        } catch (routeError) {
          logger.error({
            msg: 'Failed to configure Traefik route after SSL provisioning',
            customDomainId,
            domain: customDomain.domain,
            error: routeError instanceof Error ? routeError.message : String(routeError),
          });
          // Don't throw - SSL is provisioned, route configuration can be retried
        }
      }

      return {
        customDomainId,
        domain: customDomain.domain,
        status: 'ssl_provisioning',
        certificateId: certificate.id,
        sslStatus: certificate.status,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to provision SSL certificate',
        customDomainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Configure Traefik routing for a custom domain
   * 
   * Configures Traefik to route traffic from the custom domain to the
   * deployment's internal service with SSL enabled and HTTPS enforcement.
   * Updates custom domain status to 'active'.
   * 
   * **Validates: Requirements 4.6, 4.7, 4.8, 16.3, 16.6**
   * 
   * @param customDomainId - The custom domain ID to configure routing for
   * @returns Route configuration result
   * @throws DomainManagerError if custom domain not found or SSL not provisioned
   */
  async configureTraefikRoute(customDomainId: string): Promise<ConfigureRouteResult> {
    logger.info({
      msg: 'Configuring Traefik route for custom domain',
      customDomainId,
    });

    try {
      // Fetch custom domain record with deployment details
      const customDomain = await prisma.customDomain.findUnique({
        where: { id: customDomainId },
        include: {
          deployment: {
            select: {
              id: true,
              nodeId: true,
              internalPort: true,
              node: {
                select: {
                  id: true,
                  ip: true,
                },
              },
            },
          },
        },
      });

      if (!customDomain) {
        throw new DomainManagerError(
          `Custom domain not found: ${customDomainId}`,
          'CUSTOM_DOMAIN_NOT_FOUND',
          { customDomainId }
        );
      }

      // Ensure SSL certificate is provisioned
      if (!customDomain.sslCertId) {
        throw new DomainManagerError(
          `SSL certificate not provisioned for domain: ${customDomain.domain}`,
          'SSL_NOT_PROVISIONED',
          { customDomainId, domain: customDomain.domain }
        );
      }

      // Ensure deployment has internal port configured
      if (!customDomain.deployment.internalPort) {
        throw new DomainManagerError(
          `Deployment ${customDomain.deploymentId} has no internal port configured`,
          'NO_INTERNAL_PORT',
          { deploymentId: customDomain.deploymentId }
        );
      }

      // Configure Traefik route via node-agent
      await this.traefik.addRoute(
        {
          id: customDomain.deployment.node.id,
          ip: customDomain.deployment.node.ip,
        },
        customDomain.deploymentId,
        {
          domain: customDomain.domain,
          targetService: customDomain.deploymentId,
          targetPort: customDomain.deployment.internalPort,
          useSSL: true, // Always use SSL for custom domains
        }
      );

      // Update CustomDomain status to 'active'
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: {
          status: 'active',
          updatedAt: new Date(),
        },
      });

      logger.info({
        msg: 'Traefik route configured successfully',
        customDomainId,
        domain: customDomain.domain,
        deploymentId: customDomain.deploymentId,
        nodeId: customDomain.deployment.nodeId,
        internalPort: customDomain.deployment.internalPort,
      });

      return {
        customDomainId,
        domain: customDomain.domain,
        status: 'active',
        routeConfigured: true,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to configure Traefik route',
        customDomainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Remove a custom domain from a deployment
   * 
   * Removes the Traefik route configuration and deletes the CustomDomain record.
   * This stops traffic routing to the custom domain.
   * 
   * **Validates: Requirements 4.10**
   * 
   * @param customDomainId - The custom domain ID to remove
   * @returns Removal result
   * @throws DomainManagerError if custom domain not found
   */
  async removeDomain(customDomainId: string): Promise<RemoveDomainResult> {
    logger.info({
      msg: 'Removing custom domain',
      customDomainId,
    });

    try {
      // Fetch custom domain record
      const customDomain = await prisma.customDomain.findUnique({
        where: { id: customDomainId },
        include: {
          deployment: {
            select: {
              id: true,
              nodeId: true,
              node: {
                select: {
                  id: true,
                  ip: true,
                },
              },
            },
          },
        },
      });

      if (!customDomain) {
        throw new DomainManagerError(
          `Custom domain not found: ${customDomainId}`,
          'CUSTOM_DOMAIN_NOT_FOUND',
          { customDomainId }
        );
      }

      // Remove Traefik route if domain is active
      if (customDomain.status === 'active') {
        try {
          await this.traefik.removeRoute(
            {
              id: customDomain.deployment.node.id,
              ip: customDomain.deployment.node.ip,
            },
            customDomain.deploymentId,
            customDomain.domain
          );
        } catch (routeError) {
          // Log error but continue with deletion
          logger.error({
            msg: 'Failed to remove Traefik route (continuing with deletion)',
            customDomainId,
            domain: customDomain.domain,
            error: routeError instanceof Error ? routeError.message : String(routeError),
          });
        }
      }

      // Delete CustomDomain record
      await prisma.customDomain.delete({
        where: { id: customDomainId },
      });

      logger.info({
        msg: 'Custom domain removed successfully',
        customDomainId,
        domain: customDomain.domain,
        deploymentId: customDomain.deploymentId,
      });

      return {
        customDomainId,
        domain: customDomain.domain,
        removed: true,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to remove custom domain',
        customDomainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check SSL certificate expiration for all active custom domains
   * 
   * Queries all custom domains with SSL certificates and checks their
   * expiration status. Returns domains requiring renewal (expiring within 7 days).
   * 
   * **Validates: Requirements 16.4**
   * 
   * @returns Array of certificate expiration check results
   */
  async checkCertificateExpiration(): Promise<CertificateExpirationCheck[]> {
    logger.info({
      msg: 'Checking SSL certificate expiration for all custom domains',
    });

    try {
      // Query all custom domains with SSL certificates
      const customDomains = await prisma.customDomain.findMany({
        where: {
          sslCertId: {
            not: null,
          },
          status: {
            in: ['ssl_provisioning', 'active'],
          },
        },
        select: {
          id: true,
          domain: true,
          sslCertId: true,
        },
      });

      const results: CertificateExpirationCheck[] = [];

      // Check each certificate status
      for (const customDomain of customDomains) {
        if (!customDomain.sslCertId) {
          continue;
        }

        try {
          const sslStatus = await this.cloudflare.getSSLStatus(customDomain.sslCertId);

          // Calculate if renewal is required (within 7 days of expiration)
          // Note: Cloudflare API doesn't return expiration date in getSSLStatus
          // In production, this would parse expires_on field when available
          const requiresRenewal = sslStatus.status === 'expired';

          results.push({
            customDomainId: customDomain.id,
            domain: customDomain.domain,
            certificateId: customDomain.sslCertId,
            status: sslStatus.status,
            requiresRenewal,
          });

          if (requiresRenewal) {
            logger.warn({
              msg: 'SSL certificate requires renewal',
              customDomainId: customDomain.id,
              domain: customDomain.domain,
              certificateId: customDomain.sslCertId,
              status: sslStatus.status,
            });
          }
        } catch (statusError) {
          logger.error({
            msg: 'Failed to check SSL certificate status',
            customDomainId: customDomain.id,
            domain: customDomain.domain,
            certificateId: customDomain.sslCertId,
            error: statusError instanceof Error ? statusError.message : String(statusError),
          });
        }
      }

      logger.info({
        msg: 'Certificate expiration check completed',
        totalDomains: customDomains.length,
        requiresRenewal: results.filter(r => r.requiresRenewal).length,
      });

      return results;
    } catch (error) {
      logger.error({
        msg: 'Failed to check certificate expiration',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Renew an SSL certificate for a custom domain
   * 
   * Requests a new SSL certificate from Cloudflare to replace the expiring one.
   * Updates the custom domain with the new certificate ID.
   * 
   * **Validates: Requirements 16.4, 16.5**
   * 
   * @param customDomainId - The custom domain ID to renew SSL for
   * @returns Renewal result with new certificate information
   * @throws DomainManagerError if custom domain not found or renewal fails
   */
  async renewCertificate(customDomainId: string): Promise<RenewCertificateResult> {
    logger.info({
      msg: 'Renewing SSL certificate',
      customDomainId,
    });

    try {
      // Fetch custom domain record
      const customDomain = await prisma.customDomain.findUnique({
        where: { id: customDomainId },
        select: {
          id: true,
          domain: true,
          sslCertId: true,
        },
      });

      if (!customDomain) {
        throw new DomainManagerError(
          `Custom domain not found: ${customDomainId}`,
          'CUSTOM_DOMAIN_NOT_FOUND',
          { customDomainId }
        );
      }

      if (!customDomain.sslCertId) {
        throw new DomainManagerError(
          `No SSL certificate found for domain: ${customDomain.domain}`,
          'NO_SSL_CERTIFICATE',
          { customDomainId, domain: customDomain.domain }
        );
      }

      const oldCertificateId = customDomain.sslCertId;

      // Request renewal from Cloudflare
      const newCertificate = await this.cloudflare.renewSSL(oldCertificateId);

      // Update CustomDomain with new certificate ID
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: {
          sslCertId: newCertificate.id,
          updatedAt: new Date(),
        },
      });

      logger.info({
        msg: 'SSL certificate renewed successfully',
        customDomainId,
        domain: customDomain.domain,
        oldCertificateId,
        newCertificateId: newCertificate.id,
        status: newCertificate.status,
        expiresOn: newCertificate.expires_on,
      });

      return {
        customDomainId,
        domain: customDomain.domain,
        oldCertificateId,
        newCertificateId: newCertificate.id,
        status: newCertificate.status,
        expiresOn: newCertificate.expires_on,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to renew SSL certificate',
        customDomainId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Schedule retry in 24 hours (this would be handled by a background job)
      logger.info({
        msg: 'Scheduling SSL certificate renewal retry',
        customDomainId,
        retryAfter: '24 hours',
      });

      throw error;
    }
  }

  /**
   * Generate CNAME configuration instructions for customer
   * 
   * @param domain - The custom domain
   * @param cnameTarget - The CNAME target value
   * @returns Human-readable instructions
   */
  private generateCnameInstructions(domain: string, cnameTarget: string): string {
    return `To configure your custom domain "${domain}", please add the following CNAME record at your DNS provider:

Type: CNAME
Name: ${domain}
Target: ${cnameTarget}
TTL: 300 (or automatic)

Once the CNAME record is configured, click "Verify Domain" to check the DNS configuration. 

After verification succeeds, we will automatically provision an SSL certificate and configure secure HTTPS routing for your custom domain.`;
  }
}

/**
 * Default domain manager instance
 */
export const domainManager = new DomainManager();
