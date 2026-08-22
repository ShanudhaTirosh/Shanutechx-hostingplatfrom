import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';

export const servicesRouter = Router();

// Public catalog — no auth required, customers need to see plans before
// signing in.
servicesRouter.get('/services', async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ services });
});

const serviceSchema = z.object({
  type: z.enum([
    'web_hosting',
    'node_hosting',
    'python_hosting',
    'discordbot_python',
    'discordbot_node',
    'vps',
    'smtp',
    'livekit',
    'docker_hosting',
    'mongodb_hosting',
  ]),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  nodeId: z.string().optional().nullable(),
});

servicesRouter.post('/services', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const service = await prisma.service.create({
    data: {
      type: parsed.data.type,
      name: parsed.data.name,
      price: parsed.data.price,
      nodeId: parsed.data.nodeId || null,
    }
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'service.create', target: service.id },
  });

  res.status(201).json({ service });
});

servicesRouter.put('/services/:id', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const service = await prisma.service.update({
    where: { id: req.params.id },
    data: {
      type: parsed.data.type,
      name: parsed.data.name,
      price: parsed.data.price,
      nodeId: parsed.data.nodeId || null,
    }
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'service.update', target: service.id },
  });

  res.json({ service });
});

servicesRouter.delete('/services/:id', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  await prisma.service.delete({ where: { id: req.params.id } });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'service.delete', target: req.params.id },
  });

  res.json({ ok: true });
});
