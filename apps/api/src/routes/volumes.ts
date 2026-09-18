import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';

export const volumesRouter = Router();

volumesRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

// GET /api/deployments/:id/volumes — List persistent volumes for deployment
volumesRouter.get('/deployments/:id/volumes', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const volumes = await prisma.deploymentVolume.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ volumes });
});

const createVolumeSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  containerPath: z.string().min(1).max(255).startsWith('/'),
  sizeGb: z.number().int().min(1).max(500).default(5),
});

// POST /api/deployments/:id/volumes — Attach new persistent volume
volumesRouter.post('/deployments/:id/volumes', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = createVolumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const hostPath = `/var/lib/shanutechx/volumes/${deployment.id}/${parsed.data.name}`;

  const volume = await prisma.deploymentVolume.create({
    data: {
      deploymentId: deployment.id,
      name: parsed.data.name,
      hostPath,
      containerPath: parsed.data.containerPath,
      sizeGb: parsed.data.sizeGb,
    },
  });

  logger.info({ deploymentId: deployment.id, volumeName: volume.name, hostPath }, 'Attached persistent volume');

  res.status(201).json({ ok: true, volume });
});

// DELETE /api/deployments/:id/volumes/:volumeId — Detach persistent volume
volumesRouter.delete('/deployments/:id/volumes/:volumeId', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const volume = await prisma.deploymentVolume.findFirst({
    where: { id: req.params.volumeId, deploymentId: deployment.id },
  });

  if (!volume) return res.status(404).json({ error: 'Persistent volume not found' });

  await prisma.deploymentVolume.delete({ where: { id: volume.id } });

  logger.info({ deploymentId: deployment.id, volumeId: volume.id }, 'Detached persistent volume');

  res.json({ ok: true });
});
