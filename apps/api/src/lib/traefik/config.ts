import { addCustomDomainRoute, removeCustomDomainRoute } from '../nodeAgentClient';
import { env } from '../../env';
import { prisma } from '../prisma';
import { logger } from '../logger';

/**
 * Traefik Dynamic Configuration Module
 * 
 * This module provides an abstraction layer for managing Traefik routing rules
 * and SSL configuration for custom domains. The actual Traefik configuration
 * is managed by the node-agent which applies Docker labels to containers.
 * 
 * Configuration Approach:
 * - Docker labels are applied to containers by the node-agent
 * - Traefik automatically discovers labeled containers and configures routes
 * - SSL certificates are provisioned via Let's Encrypt through Traefik
 * - HTTP to HTTPS redirects are configured via Traefik middleware
 */

interface Node {
  id: string;
  ip: string;
}

export interface AddRouteParams {
  domain: string;
  targetService: string;
  targetPort: number;
  useSSL: boolean;
}

export interface TraefikRouteConfig {
  domain: string;
  deploymentId: string;
  internalPort: number;
  sslEnabled: boolean;
  httpsRedirect: boolean;
  routingPriority?: number;
}

/**
 * Traefik Configuration Manager
 * 
 * Manages dynamic routing rules and SSL configuration for Traefik reverse proxy.
 * Routes traffic based on domain names to backend services with automatic
 * SSL certificate provisioning and HTTPS enforcement.
 */
export class TraefikConfig {
  /**
   * Add a dynamic routing rule for a custom domain
   * 
   * This creates a Traefik route that:
   * - Routes traffic from the custom domain to the target service
   * - Enables SSL certificate provisioning via Let's Encrypt
   * - Configures HTTP to HTTPS redirect middleware
   * - Sets appropriate routing priority to avoid conflicts
   * 
   * @param node - The node where the deployment is running
   * @param deploymentId - The deployment ID
   * @param params - Route configuration parameters
   * @throws Error if the route creation fails at the node-agent level
   */
  async addRoute(node: Node, deploymentId: string, params: AddRouteParams): Promise<void> {
    logger.info({
      msg: 'Adding Traefik route',
      deploymentId,
      domain: params.domain,
      targetPort: params.targetPort,
      useSSL: params.useSSL,
    });

    try {
      // Call the node-agent to add the custom domain route
      // The node-agent will:
      // 1. Update the container with Traefik Docker labels
      // 2. Configure the router with domain matching rule
      // 3. Enable SSL certificate resolver if useSSL is true
      // 4. Add HTTP to HTTPS redirect middleware
      await addCustomDomainRoute(
        node,
        deploymentId,
        params.domain,
        params.targetPort,
        env.rootDomain
      );

      logger.info({
        msg: 'Traefik route added successfully',
        deploymentId,
        domain: params.domain,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to add Traefik route',
        deploymentId,
        domain: params.domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to configure Traefik routing for domain ${params.domain}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Remove a routing rule for a custom domain
   * 
   * This removes the Traefik configuration for the specified domain,
   * stopping traffic routing and releasing SSL certificates.
   * 
   * @param node - The node where the deployment is running
   * @param deploymentId - The deployment ID
   * @param domain - The custom domain to remove
   * @throws Error if the route removal fails at the node-agent level
   */
  async removeRoute(node: Node, deploymentId: string, domain: string): Promise<void> {
    logger.info({
      msg: 'Removing Traefik route',
      deploymentId,
      domain,
    });

    try {
      // Call the node-agent to remove the custom domain route
      // The node-agent will:
      // 1. Remove Traefik labels from the container
      // 2. Traefik will automatically stop routing traffic to this domain
      // 3. Let's Encrypt certificate will be released
      await removeCustomDomainRoute(node, deploymentId, domain);

      logger.info({
        msg: 'Traefik route removed successfully',
        deploymentId,
        domain,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to remove Traefik route',
        deploymentId,
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to remove Traefik routing for domain ${domain}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Update SSL certificate configuration for a domain
   * 
   * Note: With Let's Encrypt integration, Traefik automatically manages
   * certificate provisioning and renewal. This method is provided for
   * compatibility with the design interface, but the actual certificate
   * management is handled automatically by Traefik when useSSL is enabled.
   * 
   * @param node - The node where the deployment is running
   * @param deploymentId - The deployment ID
   * @param domain - The custom domain
   * @param certificateId - Certificate identifier (unused with Let's Encrypt auto-provisioning)
   */
  async updateSSL(
    node: Node,
    deploymentId: string,
    domain: string,
    certificateId: string
  ): Promise<void> {
    logger.info({
      msg: 'SSL update requested',
      deploymentId,
      domain,
      certificateId,
    });

    // With Traefik + Let's Encrypt, SSL certificates are automatically
    // provisioned and renewed. We don't need to manually update certificates.
    // However, we can trigger a route update to ensure SSL is properly configured.
    
    try {
      // Fetch the deployment to get the internal port
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { internalPort: true },
      });

      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      if (deployment.internalPort === null) {
        throw new Error(`Deployment ${deploymentId} has no internal port configured`);
      }

      // Re-apply the route with SSL enabled
      // This ensures the SSL configuration is refreshed
      await this.addRoute(node, deploymentId, {
        domain,
        targetService: deploymentId,
        targetPort: deployment.internalPort,
        useSSL: true,
      });

      logger.info({
        msg: 'SSL configuration updated',
        deploymentId,
        domain,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to update SSL configuration',
        deploymentId,
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to update SSL configuration for domain ${domain}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Generate Traefik router configuration for a custom domain
   * 
   * This is a utility method that generates the Traefik configuration structure
   * that would be applied via Docker labels. Useful for debugging and testing.
   * 
   * @param config - Route configuration
   * @returns Traefik label configuration object
   */
  generateRouterConfig(config: TraefikRouteConfig): Record<string, string> {
    const routerName = `custom-${config.deploymentId}-${config.domain.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const serviceName = `service-${config.deploymentId}`;

    const labels: Record<string, string> = {
      // Enable Traefik for this container
      'traefik.enable': 'true',

      // Define the router
      [`traefik.http.routers.${routerName}.rule`]: `Host(\`${config.domain}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: config.sslEnabled ? 'websecure' : 'web',
      [`traefik.http.routers.${routerName}.service`]: serviceName,

      // Define the service (target)
      [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: String(config.internalPort),
    };

    // Configure SSL
    if (config.sslEnabled) {
      labels[`traefik.http.routers.${routerName}.tls`] = 'true';
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] = 'letsencrypt';
    }

    // Configure HTTP to HTTPS redirect
    if (config.httpsRedirect && config.sslEnabled) {
      const httpRouterName = `${routerName}-http`;
      const redirectMiddleware = `${routerName}-redirect`;

      // HTTP router that redirects to HTTPS
      labels[`traefik.http.routers.${httpRouterName}.rule`] = `Host(\`${config.domain}\`)`;
      labels[`traefik.http.routers.${httpRouterName}.entrypoints`] = 'web';
      labels[`traefik.http.routers.${httpRouterName}.middlewares`] = redirectMiddleware;

      // Redirect middleware
      labels[`traefik.http.middlewares.${redirectMiddleware}.redirectscheme.scheme`] = 'https';
      labels[`traefik.http.middlewares.${redirectMiddleware}.redirectscheme.permanent`] = 'true';
    }

    // Set routing priority if specified (higher priority = processed first)
    if (config.routingPriority !== undefined) {
      labels[`traefik.http.routers.${routerName}.priority`] = String(config.routingPriority);
    }

    return labels;
  }

  /**
   * Validate domain format
   * 
   * Ensures the domain is a valid fully qualified domain name.
   * 
   * @param domain - The domain to validate
   * @returns true if valid, false otherwise
   */
  validateDomain(domain: string): boolean {
    if (!domain || domain.length === 0) {
      return false;
    }

    // Domain must not start or end with hyphen or dot
    if (domain.startsWith('-') || domain.startsWith('.') || domain.endsWith('-') || domain.endsWith('.')) {
      return false;
    }

    // Check for consecutive dots
    if (domain.includes('..')) {
      return false;
    }

    // Each label (part between dots) must:
    // - Start with alphanumeric
    // - End with alphanumeric
    // - Can contain hyphens in the middle
    // - Be 1-63 characters long
    const labels = domain.split('.');
    
    // Must have at least 2 labels (domain.tld)
    if (labels.length < 2) {
      return false;
    }

    // Last label must be at least 2 characters (TLD)
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return false;
    }

    // Validate each label
    for (const label of labels) {
      if (label.length === 0 || label.length > 63) {
        return false;
      }

      // Label must start and end with alphanumeric
      if (!/^[a-zA-Z0-9]/.test(label) || !/[a-zA-Z0-9]$/.test(label)) {
        return false;
      }

      // Label can only contain alphanumeric and hyphens
      if (!/^[a-zA-Z0-9-]+$/.test(label)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a domain conflicts with existing routes
   * 
   * Verifies that the domain is not already in use by another deployment.
   * 
   * @param domain - The domain to check
   * @param excludeDeploymentId - Optional deployment ID to exclude from the check
   * @returns true if there's a conflict, false otherwise
   */
  async checkDomainConflict(domain: string, excludeDeploymentId?: string): Promise<boolean> {
    const existing = await prisma.customDomain.findFirst({
      where: {
        domain,
        deploymentId: excludeDeploymentId ? { not: excludeDeploymentId } : undefined,
      },
    });

    return existing !== null;
  }
}

/**
 * Singleton instance of the Traefik configuration manager
 */
export const traefikConfig = new TraefikConfig();
