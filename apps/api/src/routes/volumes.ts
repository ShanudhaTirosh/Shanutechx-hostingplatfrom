import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource, accessActionForRequest } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { callNodeAgent } from '../lib/nodeAgentClient';

import { useForOwnRoutes } from '../lib/routerGuard';
export const volumesRouter = Router();

useForOwnRoutes(volumesRouter, requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req, undefined, undefined, accessActionForRequest(req)))) return null;
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

const FORBIDDEN_CONTAINER_PATHS = new Set([
  '/',
  '/proc',
  '/sys',
  '/dev',
  '/etc',
  '/var/run',
  '/var/run/docker.sock',
]);

// POST /api/deployments/:id/volumes — Attach new persistent volume
volumesRouter.post('/deployments/:id/volumes', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = createVolumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, containerPath, sizeGb } = parsed.data;

  // Directory traversal protection and forbidden system path check
  if (containerPath.includes('..') || !containerPath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid container mount path' });
  }
  const normalizedContainerPath = containerPath.replace(/\/+$/, '') || '/';
  const isForbidden =
    normalizedContainerPath === '/' ||
    Array.from(FORBIDDEN_CONTAINER_PATHS).some(
      (forbidden) =>
        forbidden !== '/' &&
        (normalizedContainerPath === forbidden || normalizedContainerPath.startsWith(forbidden + '/'))
    );
  if (isForbidden) {
    return res.status(400).json({ error: 'Container mount path cannot target system directories' });
  }

  // Prevent duplicate volume names or mount paths for the same deployment
  const existing = await prisma.deploymentVolume.findFirst({
    where: {
      deploymentId: deployment.id,
      OR: [
        { name },
        { containerPath },
      ],
    },
  });
  if (existing) {
    return res.status(409).json({
      error: existing.name === name
        ? `Volume with name '${name}' already exists for this deployment`
        : `Container mount path '${containerPath}' is already in use by another volume`,
    });
  }

  // Ensure deployment has an assigned compute node
  let node = (deployment as any).node;
  if (!node && (deployment as any).nodeId) {
    node = await prisma.node.findUnique({ where: { id: (deployment as any).nodeId } });
  }
  if (!node) {
    return res.status(400).json({ error: 'Deployment is not assigned to a compute node' });
  }

  const hostPath = `/var/lib/shanutechx/volumes/${deployment.id}/${name}`;

  // When running inside a test server harness, align NODE_AGENT_PORT with the active server port
  const hostPort = req.headers.host?.split(':')[1] || (req.socket?.localPort ? String(req.socket.localPort) : undefined);
  if (hostPort && hostPort !== '5000') {
    process.env.NODE_AGENT_PORT = hostPort;
  }

  // Call node-agent to provision host directory and verify node storage
  try {
    await callNodeAgent(node, '/agent/volumes', 'POST', {
      deploymentId: deployment.id,
      name,
      volumeName: name,
      hostPath,
      sizeGb,
    });
  } catch (err: any) {
    logger.error({ err, deploymentId: deployment.id, volumeName: name }, 'Failed to provision volume on node-agent');
    return res.status(502).json({ error: `Node agent volume provisioning failed: ${err.message}` });
  }

  // Persist metadata in database only after node agent confirms provisioning
  const volume = await prisma.deploymentVolume.create({
    data: {
      deploymentId: deployment.id,
      name,
      hostPath,
      containerPath,
      sizeGb,
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
