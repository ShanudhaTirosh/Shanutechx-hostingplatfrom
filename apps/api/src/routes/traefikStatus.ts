import { Router } from 'express';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { env } from '../env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

export const traefikStatusRouter = Router();

traefikStatusRouter.use(requireAuth, requireAdminOrDev);

async function fetchTraefikApi(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${env.traefikApiUrl}${path}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`Traefik API returned ${res.status} for ${path}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Builds local fallback routing table from real database deployments when Traefik API is offline locally.
 */
async function buildLocalFallbackRouters() {
  const deployments = await prisma.deployment.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, subdomain: true, customDomain: true, internalPort: true, status: true },
  });

  return deployments.map((dep: any) => {
    const name = dep.customDomain || dep.subdomain || dep.id;
    const domain = `${name}.${env.rootDomain}`;
    return {
      entryPoints: ['web', 'websecure'],
      service: `service-${dep.id}@docker`,
      rule: `Host(\`${domain}\`)`,
      status: dep.status === 'running' ? 'enabled' : 'disabled',
      using: ['websecure'],
      name: `${name}@docker`,
      provider: 'docker',
      internalPort: dep.internalPort,
    };
  });
}

traefikStatusRouter.get('/traefik/overview', async (_req: AuthedRequest, res) => {
  try {
    const overview = await fetchTraefikApi('/api/overview');
    res.json({ overview, isFallback: false });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Traefik API unreachable — building fallback overview from DB deployments');
    const deploymentsCount = await prisma.deployment.count().catch(() => 0);
    res.json({
      overview: {
        http: {
          routers: { total: deploymentsCount, warnings: 0, errors: 0 },
          services: { total: deploymentsCount, warnings: 0, errors: 0 },
          middlewares: { total: 2, warnings: 0, errors: 0 },
        },
      },
      isFallback: true,
      notice: `Local Traefik gateway API at ${env.traefikApiUrl} is offline — showing active database deployment routes.`,
    });
  }
});

traefikStatusRouter.get('/traefik/routers', async (_req: AuthedRequest, res) => {
  try {
    const routers = await fetchTraefikApi('/api/http/routers');
    res.json({ routers, isFallback: false });
  } catch (err: any) {
    const routers = await buildLocalFallbackRouters();
    res.json({ routers, isFallback: true });
  }
});

traefikStatusRouter.get('/traefik/services', async (_req: AuthedRequest, res) => {
  try {
    const services = await fetchTraefikApi('/api/http/services');
    res.json({ services, isFallback: false });
  } catch (err: any) {
    const deployments = await prisma.deployment.findMany({
      select: { id: true, subdomain: true, customDomain: true, internalPort: true, status: true },
    });
    const services = deployments.map((dep: any) => ({
      loadBalancer: {
        servers: [{ url: `http://localhost:${dep.internalPort}` }],
        passHostHeader: true,
      },
      status: dep.status === 'running' ? 'enabled' : 'disabled',
      name: `service-${dep.id}@docker`,
      provider: 'docker',
    }));
    res.json({ services, isFallback: true });
  }
});

traefikStatusRouter.get('/traefik/middlewares', async (_req: AuthedRequest, res) => {
  try {
    const middlewares = await fetchTraefikApi('/api/http/middlewares');
    res.json({ middlewares, isFallback: false });
  } catch (err: any) {
    res.json({
      middlewares: [
        { name: 'redirect-to-https@docker', status: 'enabled', provider: 'docker' },
        { name: 'security-headers@docker', status: 'enabled', provider: 'docker' },
      ],
      isFallback: true,
    });
  }
});
