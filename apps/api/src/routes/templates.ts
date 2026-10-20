import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';

import { useForOwnRoutes } from '../lib/routerGuard';
export const templatesRouter = Router();

useForOwnRoutes(templatesRouter, requireAuth);

/** Customers browse public templates to pre-fill a deployment instead of bringing their own repo. */
templatesRouter.get('/templates', async (_req, res) => {
  const templates = await prisma.deploymentTemplate.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ templates });
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  iconUrl: z.string().url().optional(),
  repoUrl: z.string().url(),
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).default('main'),
  runtime: z.enum(['nodejs', 'python', 'static']),
  internalPort: z.number().int().positive(),
  defaultEnvVars: z.record(z.string()).optional(),
  isPublic: z.boolean().default(true),
});

// Deciding which stacks/runtimes the platform supports is an engineering
// decision, not a business-operations one — admin-or-dev, same reasoning
// as nodes/Leaseweb/managed-databases.
templatesRouter.post('/templates', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = createTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const template = await prisma.deploymentTemplate.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'template.create', target: template.id },
  });

  res.status(201).json({ template });
});

templatesRouter.patch('/templates/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = createTemplateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const template = await prisma.deploymentTemplate.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json({ template });
});

templatesRouter.delete('/templates/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  await prisma.deploymentTemplate.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
