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
dockerDeploymentsRouter.post('/deployments/docker-image', async (_req: AuthedRequest, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Direct Docker image deployment runner is not currently supported. Please connect a Git repository to deploy your application.',
  });
});

dockerDeploymentsRouter.post('/deployments/docker-compose', async (_req: AuthedRequest, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Docker Compose stack deployment runner is not currently supported. Please connect a Git repository to deploy your application.',
  });
});

