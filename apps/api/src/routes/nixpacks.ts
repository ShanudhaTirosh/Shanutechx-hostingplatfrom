import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';

export const nixpacksRouter = Router();

nixpacksRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

const nixpacksConfigSchema = z.object({
  builder: z.enum(['NIXPACKS', 'RAILWAYPACK', 'DOCKERFILE', 'AUTO']).optional().default('AUTO'),
  runtimeVersion: z.string().max(50).optional(), // e.g. "nodejs_20", "python311", "go_121"
  phases: z
    .object({
      setup: z.object({ nixPkgs: z.array(z.string()).optional(), cmds: z.array(z.string()).optional() }).optional(),
      install: z.object({ cmds: z.array(z.string()).optional() }).optional(),
      build: z.object({ cmds: z.array(z.string()).optional() }).optional(),
      start: z.object({ cmd: z.string().optional() }).optional(),
    })
    .optional(),
  watchPaths: z.array(z.string()).optional().default([]),
  rootDir: z.string().max(255).optional().nullable(),
});

// GET /api/deployments/:id/nixpacks — Get Nixpacks / Monorepo build config
nixpacksRouter.get('/deployments/:id/nixpacks', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  res.json({
    rootDir: deployment.rootDir,
    watchPaths: deployment.watchPaths,
    nixpacksConfig: deployment.nixpacksConfig || {
      builder: 'AUTO',
      runtimeVersion: 'nodejs_20',
      phases: {},
    },
  });
});

// PUT /api/deployments/:id/nixpacks — Update Nixpacks / Monorepo build config
nixpacksRouter.put('/deployments/:id/nixpacks', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = nixpacksConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      rootDir: parsed.data.rootDir || null,
      watchPaths: parsed.data.watchPaths,
      nixpacksConfig: parsed.data as any,
    },
  });

  logger.info({ deploymentId: deployment.id, rootDir: updated.rootDir }, 'Updated Nixpacks & Monorepo config');

  res.json({
    ok: true,
    rootDir: updated.rootDir,
    watchPaths: updated.watchPaths,
    nixpacksConfig: updated.nixpacksConfig,
  });
});
