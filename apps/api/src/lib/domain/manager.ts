/**
 * Domain Manager Module
 * 
 * Handles custom domain attachment, CNAME verification, SSL certificate
 * provisioning, and Traefik routing configuration for deployments.
 * 
 * Responsibilities:
 * - Generate CNAME targets for custom domains
 * - Verify CNAME DNS records resolve correctly
 * - Configure Traefik dynamic routing for custom domains
 * - Enforce HTTPS redirection for custom domains
 * - Support multiple domains per deployment
 *
 * SSL MODEL: SSL/TLS is provided exclusively by Traefik + Let's Encrypt
 * (free, auto-provisioning, auto-renewing). Traefik obtains and renews
 * certificates automatically from the `letsencrypt` ACME resolver when a
 * custom-domain route is applied via Docker labels. Cloudflare is used for
 * DNS only (CNAME creation/verification) — never for certificate packs.
 * This avoids Cloudflare's paid advanced-certificate requirement while
 * keeping SSL fully free for every customer domain.
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
   * Provision SSL for a custom domain
   * 
   * SSL is provided by Traefik + Let's Encrypt (free ACME auto-provisioning).
   * No Cloudflare certificate pack is requested — Traefik obtains the
   * certificate automatically via Docker labels when the custom-domain route
   * is applied. This method applies the Traefik route (which triggers LE
   * issuance) and marks the domain active.
   * 
   * @param customDomainId - The custom domain ID to provision SSL for
   * @returns SSL provisioning result
   * @throws DomainManagerError if custom domain not found or not verified
   */
  async provisionSSL(customDomainId: string): Promise<ProvisionSSLResult> {
    logger.info({
      msg: 'Provisioning SSL (Traefik + Let\'s Encrypt)',
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

      if (!customDomain.deployment) {
        throw new DomainManagerError(
          `Deployment not found for custom domain: ${customDomainId}`,
          'DEPLOYMENT_NOT_FOUND',
          { customDomainId }
        );
      }

      if (!customDomain.deployment.nodeId) {
        throw new DomainManagerError(
          `Deployment ${customDomain.deploymentId} has no node assigned`,
          'NO_NODE',
          { deploymentId: customDomain.deploymentId }
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

      // Configure the Traefik route. Applied via Docker labels, this makes
      // Traefik request a Let's Encrypt certificate automatically (free + auto-renewed).
      await this.configureTraefikRoute(customDomainId);

      return {
        customDomainId,
        domain: customDomain.domain,
        status: 'active',
        certificateId: '',
        sslStatus: 'active',
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

      if (!customDomain.deployment) {
        throw new DomainManagerError(
          `Deployment not found for custom domain: ${customDomainId}`,
          'DEPLOYMENT_NOT_FOUND',
          { customDomainId, deploymentId: customDomain.deploymentId }
        );
      }

      // SSL is provided by Traefik + Let's Encrypt via Docker labels, so there
      // is no Cloudflare certificate to require. The route application is what
      // triggers LE certificate issuance.

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
   * Check SSL certificate status for all custom domains
   * 
   * Under the Traefik + Let's Encrypt SSL model, certificates are provisioned
   * and renewed automatically by Traefik's ACME resolver — there is no
   * Cloudflare certificate pack to track or renew. This method is retained
   * for the (now no-op) daily job and returns no renewals required.
   * 
   * @returns Empty array (Let's Encrypt auto-renews; nothing to do here)
   */
  async checkCertificateExpiration(): Promise<CertificateExpirationCheck[]> {
    logger.info({
      msg: 'SSL certificate check: Let\'s Encrypt auto-renews, skipping manual check',
    });

    return [];
  }

  /**
   * Renew an SSL certificate for a custom domain
   * 
   * Under the Traefik + Let's Encrypt model, certificates are renewed
   * automatically by Traefik's ACME resolver. No manual/Cloudflare renewal is
   * performed; this method is retained for the (now no-op) daily job and
   * reports a no-op success.
   * 
   * @param customDomainId - The custom domain ID (unused for LE auto-renewal)
   * @returns No-op renewal result
   * @throws DomainManagerError if custom domain not found
   */
  async renewCertificate(customDomainId: string): Promise<RenewCertificateResult> {
    logger.info({
      msg: 'SSL certificate renewal: Let\'s Encrypt auto-renews, skipping manual renewal',
      customDomainId,
    });

    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
      select: {
        id: true,
        domain: true,
      },
    });

    if (!customDomain) {
      throw new DomainManagerError(
        `Custom domain not found: ${customDomainId}`,
        'CUSTOM_DOMAIN_NOT_FOUND',
        { customDomainId }
      );
    }

    return {
      customDomainId,
      domain: customDomain.domain,
      oldCertificateId: 'lets-encrypt',
      newCertificateId: 'lets-encrypt',
      status: 'active',
      expiresOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
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
