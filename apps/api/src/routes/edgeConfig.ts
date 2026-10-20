import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

import { useForOwnRoutes } from '../lib/routerGuard';
export const edgeConfigRouter = Router();

useForOwnRoutes(edgeConfigRouter, requireAuth);

// GET /api/edge-config — List Edge Config stores owned by user
edgeConfigRouter.get('/edge-config', async (req: AuthedRequest, res) => {
  const stores = await prisma.edgeConfigStore.findMany({
    where: { userId: req.user!.id },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({ stores });
});

const createStoreSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9\-]+$/),
  description: z.string().max(255).optional(),
});

// POST /api/edge-config — Create a new Edge Config store
edgeConfigRouter.post('/edge-config', async (req: AuthedRequest, res) => {
  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.edgeConfigStore.findUnique({
    where: { slug: parsed.data.slug },
  });

  if (existing) {
    return res.status(409).json({ error: 'Edge Config store slug already taken' });
  }

  const store = await prisma.edgeConfigStore.create({
    data: {
      userId: req.user!.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
    },
  });

  logger.info({ storeId: store.id, slug: store.slug }, 'Edge Config store created');

  return res.status(201).json({ ok: true, store });
});

// GET /api/edge-config/:slug/items — Get all items in store
edgeConfigRouter.get('/edge-config/:slug/items', async (req: AuthedRequest, res) => {
  const store = await prisma.edgeConfigStore.findFirst({
    where: { slug: req.params.slug, userId: req.user!.id },
    include: { items: true },
  });

  if (!store) return res.status(404).json({ error: 'Edge Config store not found' });

  const itemsMap: Record<string, unknown> = {};
  for (const item of store.items) {
    itemsMap[item.key] = item.valueJson;
  }

  return res.json({ store: { id: store.id, slug: store.slug, name: store.name }, items: itemsMap });
});

const setItemSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.any(),
});

// POST /api/edge-config/:slug/items — Set or update a key-value item
edgeConfigRouter.post('/edge-config/:slug/items', async (req: AuthedRequest, res) => {
  const store = await prisma.edgeConfigStore.findFirst({
    where: { slug: req.params.slug, userId: req.user!.id },
  });

  if (!store) return res.status(404).json({ error: 'Edge Config store not found' });

  const parsed = setItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const item = await prisma.edgeConfigItem.upsert({
    where: {
      storeId_key: {
        storeId: store.id,
        key: parsed.data.key,
      },
    },
    create: {
      storeId: store.id,
      key: parsed.data.key,
      valueJson: parsed.data.value ?? null,
    },
    update: {
      valueJson: parsed.data.value ?? null,
    },
  });

  await prisma.edgeConfigStore.update({
    where: { id: store.id },
    data: { updatedAt: new Date() },
  });

  return res.json({ ok: true, item });
});

// DELETE /api/edge-config/:slug/items/:key — Delete a key-value item
edgeConfigRouter.delete('/edge-config/:slug/items/:key', async (req: AuthedRequest, res) => {
  const store = await prisma.edgeConfigStore.findFirst({
    where: { slug: req.params.slug, userId: req.user!.id },
  });

  if (!store) return res.status(404).json({ error: 'Edge Config store not found' });

  await prisma.edgeConfigItem.deleteMany({
    where: { storeId: store.id, key: req.params.key },
  });

  return res.json({ ok: true });
});
