import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';

export const previewToolbarRouter = Router();

previewToolbarRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

// GET /api/preview/:deploymentId/comments — List visual feedback comments for a preview URL
previewToolbarRouter.get('/preview/:deploymentId/comments', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.deploymentId);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const comments = await prisma.previewComment.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ comments });
});

const createCommentSchema = z.object({
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  elementPath: z.string().max(500).optional(),
  commentText: z.string().min(1).max(2000),
});

// POST /api/preview/:deploymentId/comments — Add a new visual feedback comment
previewToolbarRouter.post('/preview/:deploymentId/comments', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.deploymentId);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const comment = await prisma.previewComment.create({
    data: {
      deploymentId: deployment.id,
      userId: req.user!.id,
      userName: req.user!.email || 'Anonymous',
      xPct: parsed.data.xPct,
      yPct: parsed.data.yPct,
      elementPath: parsed.data.elementPath || null,
      commentText: parsed.data.commentText,
    },
  });

  logger.info({ deploymentId: deployment.id, commentId: comment.id }, 'Preview comment created');

  return res.status(201).json({ ok: true, comment });
});

// PATCH /api/preview/:deploymentId/comments/:commentId/resolve — Toggle resolve status
previewToolbarRouter.patch('/preview/:deploymentId/comments/:commentId/resolve', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.deploymentId);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const comment = await prisma.previewComment.findFirst({
    where: { id: req.params.commentId, deploymentId: deployment.id },
  });

  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const updated = await prisma.previewComment.update({
    where: { id: comment.id },
    data: { isResolved: !comment.isResolved },
  });

  return res.json({ ok: true, comment: updated });
});
