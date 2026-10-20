/**
 * Domain API Routes
 * 
 * Provides REST API endpoints for custom domain management including
 * domain attachment, CNAME verification, SSL certificate provisioning,
 * and domain removal.
 * 
 * Authorization:
 * - All endpoints require authentication
 * - Domain operations require deployment/domain ownership or admin role
 * - Uses verifyResourceOwnershipAsync for fine-grained access control
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { verifyResourceOwnershipAsync } from '../middleware/rbac';
import { domainManager, DomainManagerError } from '../lib/domain/manager';
import { createCnameViaCloudflare } from '../lib/cloudflareDns';
import { logger } from '../lib/logger';

import { useForOwnRoutes } from '../lib/routerGuard';
export const domainsRouter = Router();

// All domain endpoints require authentication
useForOwnRoutes(domainsRouter, requireAuth);

/**
 * Request body schema for attaching a custom domain
 */
const attachDomainSchema = z.object({
  deploymentId: z.string().min(1, 'Deployment ID is required'),
  domain: z
    .string()
    .min(3, 'Domain must be at least 3 characters')
    .max(253, 'Domain exceeds maximum length')
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Invalid domain format'
    ),
  cloudflareApiToken: z.string().optional(),
  cloudflareZoneId: z.string().optional(),
});

/**
 * POST /api/domains/attach
 * 
 * Attach a custom domain to a deployment. This creates a CustomDomain
 * record with status 'pending' and returns CNAME configuration instructions.
 * 
 * Request Body:
 * - deploymentId: string - The deployment ID to attach the domain to
 * - domain: string - Fully qualified domain name (e.g., "app.example.com")
 * 
 * Response:
 * - customDomain: CustomDomain object
 * - cnameTarget: string - The CNAME target value for DNS configuration
 * - instructions: string - Human-readable setup instructions
 * 
 * Authorization:
 * - Requires deployment ownership (customer owns deployment or admin/dev role)
 * 
 * Errors:
 * - 400: Invalid request data (invalid domain format, missing fields)
 * - 403: Insufficient permissions (not deployment owner)
 * - 404: Deployment not found
 * - 409: Domain already attached to another deployment
 * - 500: Internal server error
 */
domainsRouter.post('/domains/attach', async (req: AuthedRequest, res) => {
  // Validate request body
  const parsed = attachDomainSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: parsed.error.flatten(),
    });
  }

  const { deploymentId, domain, cloudflareApiToken, cloudflareZoneId } = parsed.data;

  try {
    // Fetch deployment to verify ownership
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: {
        id: true,
        userId: true,
        subdomain: true,
        internalPort: true,
      },
    });

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
        message: `No deployment found with ID: ${deploymentId}`,
      });
    }

    // Verify deployment ownership using RBAC utility
    // Returns 404 for customers accessing other customers' deployments
    if (!(await verifyResourceOwnershipAsync(deployment.userId, req, res))) {
      return; // Response already sent by verifyResourceOwnershipAsync
    }

    // Attach custom domain using domain manager
    const result = await domainManager.attachCustomDomain(deploymentId, domain);

    let autoCreated = false;
    let cfMessage = '';
    if (cloudflareApiToken && cloudflareZoneId) {
      try {
        await createCnameViaCloudflare({
          apiToken: cloudflareApiToken,
          zoneId: cloudflareZoneId,
          domain,
          target: result.cnameTarget,
        });
        autoCreated = true;
        cfMessage = ' CNAME record automatically created in your Cloudflare zone!';
      } catch (cfErr: any) {
        cfMessage = ` (Automated Cloudflare creation error: ${cfErr.message}. Please configure the CNAME manually).`;
      }
    }

    logger.info({
      msg: 'Custom domain attached via API',
      userId: req.user!.id,
      deploymentId,
      domain,
      customDomainId: result.customDomainId,
      autoCreated,
    });

    res.status(201).json({
      customDomain: {
        id: result.customDomainId,
        domain: result.domain,
        status: result.status,
        cnameTarget: result.cnameTarget,
      },
      cnameTarget: result.cnameTarget,
      instructions: result.instructions + cfMessage,
      autoCreated,
    });
  } catch (error) {
    if (error instanceof DomainManagerError) {
      // Handle domain manager specific errors
      switch (error.code) {
        case 'INVALID_DOMAIN_FORMAT':
          return res.status(400).json({
            error: 'Invalid domain format',
            message: error.message,
          });
        case 'DEPLOYMENT_NOT_FOUND':
          return res.status(404).json({
            error: 'Deployment not found',
            message: error.message,
          });
        case 'DOMAIN_ALREADY_EXISTS':
          return res.status(409).json({
            error: 'Domain already attached',
            message: error.message,
          });
        case 'NO_SUBDOMAIN':
          return res.status(409).json({
            error: 'Deployment has no subdomain',
            message:
              'This deployment does not have a public subdomain assigned and cannot have custom domains attached',
          });
        default:
          logger.error({
            msg: 'Domain manager error in attach endpoint',
            userId: req.user!.id,
            deploymentId,
            domain,
            error: error.message,
            code: error.code,
          });
          return res.status(500).json({
            error: 'Failed to attach custom domain',
            message: 'An error occurred while attaching the domain. Please try again.',
          });
      }
    }

    // Handle unexpected errors
    logger.error({
      msg: 'Unexpected error in attach domain endpoint',
      userId: req.user!.id,
      deploymentId,
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /api/domains/:id/verify
 * 
 * Verify a custom domain's CNAME record. Checks if the CNAME resolves
 * correctly and if verified, triggers SSL certificate provisioning and
 * Traefik routing configuration.
 * 
 * Path Parameters:
 * - id: string - The custom domain ID
 * 
 * Response:
 * - status: 'verified' | 'failed' - Verification result
 * - domain: string - The custom domain
 * - resolvedTarget: string - The DNS CNAME target that was resolved
 * - sslStatus: string - SSL certificate provisioning status
 * - message: string - Human-readable status message
 * 
 * Authorization:
 * - Requires domain ownership (via deployment ownership)
 * 
 * Errors:
 * - 400: Invalid domain ID format
 * - 403: Insufficient permissions (not domain owner)
 * - 404: Custom domain not found
 * - 409: CNAME verification failed (wrong target or not configured)
 * - 500: Internal server error
 */
domainsRouter.post('/domains/:id/verify', async (req: AuthedRequest, res) => {
  const customDomainId = req.params.id;

  // Validate domain ID format
  if (!customDomainId || customDomainId.length < 10) {
    return res.status(400).json({
      error: 'Invalid domain ID',
      message: 'The provided domain ID is not valid',
    });
  }

  try {
    // Fetch custom domain with deployment to verify ownership
    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        deployment: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!customDomain || !customDomain.deployment) {
      return res.status(404).json({
        error: 'Custom domain not found',
        message: `No custom domain found with ID: ${customDomainId}`,
      });
    }

    // Verify domain ownership via deployment ownership
    if (!(await verifyResourceOwnershipAsync(customDomain.deployment.userId, req, res))) {
      return; // Response already sent
    }

    // Verify domain using domain manager
    const result = await domainManager.verifyDomain(customDomainId);

    logger.info({
      msg: 'Domain verification attempted via API',
      userId: req.user!.id,
      customDomainId,
      domain: result.domain,
      verified: result.verified,
      status: result.status,
    });

    if (!result.verified) {
      // Verification failed
      return res.status(409).json({
        status: 'failed',
        domain: result.domain,
        verified: false,
        resolvedTarget: result.resolvedTarget,
        expectedTarget: customDomain.cnameTarget,
        message:
          result.resolvedTarget === ''
            ? `CNAME record not found. Please add a CNAME record: ${result.domain} -> ${customDomain.cnameTarget}`
            : `CNAME record points to incorrect target. Expected: ${customDomain.cnameTarget}, Found: ${result.resolvedTarget}`,
      });
    }

    // Verification succeeded
    res.json({
      status: 'verified',
      domain: result.domain,
      verified: true,
      resolvedTarget: result.resolvedTarget,
      sslStatus: result.sslStatus || 'pending',
      message:
        result.sslStatus === 'active'
          ? 'Domain verified successfully and SSL certificate is active. Your custom domain is now live!'
          : 'Domain verified successfully. SSL certificate is being provisioned.',
    });
  } catch (error) {
    if (error instanceof DomainManagerError) {
      // Handle domain manager specific errors
      switch (error.code) {
        case 'CUSTOM_DOMAIN_NOT_FOUND':
          return res.status(404).json({
            error: 'Custom domain not found',
            message: error.message,
          });
        default:
          logger.error({
            msg: 'Domain manager error in verify endpoint',
            userId: req.user!.id,
            customDomainId,
            error: error.message,
            code: error.code,
          });
          return res.status(500).json({
            error: 'Verification failed',
            message: 'An error occurred during verification. Please try again.',
          });
      }
    }

    // Handle unexpected errors
    logger.error({
      msg: 'Unexpected error in verify domain endpoint',
      userId: req.user!.id,
      customDomainId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * DELETE /api/domains/:id
 * 
 * Remove a custom domain from a deployment. Removes the Traefik routing
 * configuration and deletes the CustomDomain record.
 * 
 * Path Parameters:
 * - id: string - The custom domain ID
 * 
 * Response:
 * - success: boolean - Whether the removal succeeded
 * - domain: string - The removed domain name
 * - message: string - Human-readable status message
 * 
 * Authorization:
 * - Requires domain ownership (via deployment ownership)
 * 
 * Errors:
 * - 400: Invalid domain ID format
 * - 403: Insufficient permissions (not domain owner)
 * - 404: Custom domain not found
 * - 500: Internal server error
 */
domainsRouter.delete('/domains/:id', async (req: AuthedRequest, res) => {
  const customDomainId = req.params.id;

  // Validate domain ID format
  if (!customDomainId || customDomainId.length < 10) {
    return res.status(400).json({
      error: 'Invalid domain ID',
      message: 'The provided domain ID is not valid',
    });
  }

  try {
    // Fetch custom domain with deployment to verify ownership
    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        deployment: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!customDomain || !customDomain.deployment) {
      return res.status(404).json({
        error: 'Custom domain not found',
        message: `No custom domain found with ID: ${customDomainId}`,
      });
    }

    // Verify domain ownership via deployment ownership
    if (!(await verifyResourceOwnershipAsync(customDomain.deployment.userId, req, res))) {
      return; // Response already sent
    }

    // Remove domain using domain manager
    const result = await domainManager.removeDomain(customDomainId);

    logger.info({
      msg: 'Custom domain removed via API',
      userId: req.user!.id,
      customDomainId,
      domain: result.domain,
      deploymentId: customDomain.deployment.id,
    });

    res.json({
      success: result.removed,
      domain: result.domain,
      message: `Custom domain "${result.domain}" has been successfully removed`,
    });
  } catch (error) {
    if (error instanceof DomainManagerError) {
      // Handle domain manager specific errors
      switch (error.code) {
        case 'CUSTOM_DOMAIN_NOT_FOUND':
          return res.status(404).json({
            error: 'Custom domain not found',
            message: error.message,
          });
        default:
          logger.error({
            msg: 'Domain manager error in remove endpoint',
            userId: req.user!.id,
            customDomainId,
            error: error.message,
            code: error.code,
          });
          return res.status(500).json({
            error: 'Removal failed',
            message: 'An error occurred while removing the domain. Please try again.',
          });
      }
    }

    // Handle unexpected errors
    logger.error({
      msg: 'Unexpected error in remove domain endpoint',
      userId: req.user!.id,
      customDomainId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * GET /api/deployments/:id/domains
 * 
 * List all custom domains attached to a deployment. Returns an array of
 * CustomDomain records with their current status and configuration.
 * 
 * Path Parameters:
 * - id: string - The deployment ID
 * 
 * Response:
 * - domains: CustomDomain[] - Array of custom domain objects
 * - total: number - Total count of domains
 * 
 * Authorization:
 * - Requires deployment ownership
 * 
 * Errors:
 * - 400: Invalid deployment ID format
 * - 403: Insufficient permissions (not deployment owner)
 * - 404: Deployment not found
 * - 500: Internal server error
 */
domainsRouter.get('/deployments/:id/domains', async (req: AuthedRequest, res) => {
  const deploymentId = req.params.id;

  // Validate deployment ID format
  if (!deploymentId || deploymentId.length < 10) {
    return res.status(400).json({
      error: 'Invalid deployment ID',
      message: 'The provided deployment ID is not valid',
    });
  }

  try {
    // Fetch deployment to verify ownership
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
        message: `No deployment found with ID: ${deploymentId}`,
      });
    }

    // Verify deployment ownership
    if (!(await verifyResourceOwnershipAsync(deployment.userId, req, res))) {
      return; // Response already sent
    }

    // Fetch all custom domains for this deployment
    const customDomains = await prisma.customDomain.findMany({
      where: { deploymentId },
      select: {
        id: true,
        domain: true,
        cnameTarget: true,
        status: true,
        sslCertId: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info({
      msg: 'Deployment domains listed via API',
      userId: req.user!.id,
      deploymentId,
      domainCount: customDomains.length,
    });

    res.json({
      domains: customDomains,
      total: customDomains.length,
    });
  } catch (error) {
    logger.error({
      msg: 'Unexpected error in list deployment domains endpoint',
      userId: req.user!.id,
      deploymentId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});
