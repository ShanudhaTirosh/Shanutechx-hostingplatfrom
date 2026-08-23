import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { generateSubdomain } from '../lib/subdomain';
import { selectNodeForDeployment } from '../lib/nodeSelector';
import { logger } from '../lib/logger';

export const dockerDeploymentsRouter = Router();

dockerDeploymentsRouter.use(requireAuth);

const deployImageSchema = z.object({
  image: z.string().min(1, 'Docker image name is required'),
  preferredName: z.string().min(1, 'Name is required'),
  internalPort: z.number().default(80),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
});

/**
 * POST /api/deployments/docker-image
 * Deploys an arbitrary Docker image from public/private Docker Registry.
 */
dockerDeploymentsRouter.post('/deployments/docker-image', async (req: AuthedRequest, res) => {
  const parsed = deployImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { image, preferredName, internalPort, envVars } = parsed.data;

  try {
    const subdomain = await generateSubdomain(preferredName);
    const node = await selectNodeForDeployment({ requiredTag: 'web-hosting' });

    const deployment = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        subdomain,
        repoUrl: `docker://${image}`,
        branch: 'latest',
        nodeId: node.id,
      },
    });

    logger.info({ deploymentId: deployment.id, image }, 'Created Docker image deployment');
    res.status(201).json({ ok: true, deployment });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger Docker image deployment' });
  }
});

const deployComposeSchema = z.object({
  composeYaml: z.string().min(1, 'Docker Compose YAML is required'),
  preferredName: z.string().min(1, 'Project name is required'),
  nodeId: z.string().optional(),
});

/**
 * POST /api/deployments/docker-compose
 * Deploys a multi-container stack defined by raw Docker Compose YAML.
 */
dockerDeploymentsRouter.post('/deployments/docker-compose', async (req: AuthedRequest, res) => {
  const parsed = deployComposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { composeYaml, preferredName } = parsed.data;

  try {
    const subdomain = await generateSubdomain(preferredName);
    const node = await selectNodeForDeployment({ requiredTag: 'web-hosting' });

    const deployment = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        subdomain,
        repoUrl: `compose://${preferredName}`,
        branch: 'main',
        nodeId: node.id,
      },
    });

    logger.info({ deploymentId: deployment.id, preferredName }, 'Created Docker Compose stack deployment');
    res.status(201).json({ ok: true, deployment, composeYaml });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger Docker Compose deployment' });
  }
});

