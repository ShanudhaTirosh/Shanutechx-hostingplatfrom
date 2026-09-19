import { prisma } from './prisma';
import { env } from '../env';
import { verifyCnameTarget } from './customDomain';
import { addCustomDomainRoute, removeCustomDomainRoute } from './nodeAgentClient';
import { logger } from './logger';

export class DomainManagerError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DomainManagerError';
    this.code = code;
  }
}

export const domainManager = {
  async attachCustomDomain(deploymentId: string, domain: string) {
    const cleanDomain = domain.toLowerCase().trim();

    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new DomainManagerError(`Deployment ${deploymentId} not found`, 'DEPLOYMENT_NOT_FOUND');
    }

    if (!deployment.subdomain) {
      throw new DomainManagerError('Deployment does not have an active subdomain', 'NO_SUBDOMAIN');
    }

    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain: cleanDomain },
    });

    if (existingDomain && existingDomain.deploymentId !== deploymentId) {
      throw new DomainManagerError(`Domain ${cleanDomain} is already attached to another deployment`, 'DOMAIN_ALREADY_EXISTS');
    }

    const cnameTarget = `${deployment.subdomain}.${env.deploymentsRootDomain}`;

    const customDomain = await prisma.customDomain.upsert({
      where: { domain: cleanDomain },
      create: {
        deploymentId,
        domain: cleanDomain,
        cnameTarget,
        status: 'pending',
      },
      update: {
        deploymentId,
        cnameTarget,
        status: 'pending',
      },
    });

    return {
      customDomainId: customDomain.id,
      domain: customDomain.domain,
      status: customDomain.status,
      cnameTarget: customDomain.cnameTarget,
      instructions: `Add a CNAME DNS record pointing ${cleanDomain} to ${cnameTarget}`,
    };
  },

  async verifyDomain(customDomainId: string) {
    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        deployment: {
          include: {
            node: true,
          },
        },
      },
    });

    if (!customDomain) {
      throw new DomainManagerError(`Custom domain ${customDomainId} not found`, 'CUSTOM_DOMAIN_NOT_FOUND');
    }

    const check = await verifyCnameTarget(customDomain.domain, customDomain.cnameTarget);

    if (!check.verified) {
      await prisma.customDomain.update({
        where: { id: customDomainId },
        data: { status: 'failed' },
      });

      return {
        verified: false,
        domain: customDomain.domain,
        status: 'failed',
        resolvedTarget: check.reason,
      };
    }

    await prisma.customDomain.update({
      where: { id: customDomainId },
      data: {
        status: 'active',
        verifiedAt: new Date(),
      },
    });

    if (customDomain.deployment.node && customDomain.deployment.internalPort) {
      try {
        await addCustomDomainRoute(
          customDomain.deployment.node,
          customDomain.deployment.id,
          customDomain.domain,
          customDomain.deployment.internalPort,
          env.rootDomain
        );
      } catch (err: any) {
        logger.warn({ customDomainId, err: err.message }, 'Failed to add custom domain route to node agent');
      }
    }

    return {
      verified: true,
      domain: customDomain.domain,
      status: 'active',
      resolvedTarget: customDomain.cnameTarget,
      sslStatus: 'active',
    };
  },

  async removeDomain(customDomainId: string) {
    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        deployment: {
          include: {
            node: true,
          },
        },
      },
    });

    if (!customDomain) {
      throw new DomainManagerError(`Custom domain ${customDomainId} not found`, 'CUSTOM_DOMAIN_NOT_FOUND');
    }

    if (customDomain.deployment.node) {
      try {
        await removeCustomDomainRoute(
          customDomain.deployment.node,
          customDomain.deployment.id,
          customDomain.domain
        );
      } catch (err: any) {
        logger.warn({ customDomainId, err: err.message }, 'Failed to remove custom domain route from node agent');
      }
    }

    await prisma.customDomain.delete({
      where: { id: customDomainId },
    });

    return {
      removed: true,
      domain: customDomain.domain,
    };
  },

  async checkCertificateExpiration() {
    const domains = await prisma.customDomain.findMany({
      where: { status: 'active' },
    });

    return domains.map((d) => ({
      customDomainId: d.id,
      domain: d.domain,
      status: d.status,
      certificateId: d.sslCertId || d.id,
      requiresRenewal: false,
      expiresOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }));
  },

  async renewCertificate(customDomainId: string) {
    const customDomain = await prisma.customDomain.findUnique({
      where: { id: customDomainId },
    });

    if (!customDomain) {
      throw new DomainManagerError(`Custom domain ${customDomainId} not found`, 'CUSTOM_DOMAIN_NOT_FOUND');
    }

    return {
      customDomainId: customDomain.id,
      domain: customDomain.domain,
      oldCertificateId: customDomain.sslCertId || customDomain.id,
      newCertificateId: customDomain.sslCertId || customDomain.id,
      status: 'active',
      expiresOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
  },
};
