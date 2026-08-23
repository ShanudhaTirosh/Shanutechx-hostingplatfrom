import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { generateApiKey } from '../lib/apiKeys';

export const apiKeysRouter = Router();

apiKeysRouter.use(requireAuth);

apiKeysRouter.get('/api-keys', async (req: AuthedRequest, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, keyPrefix: true, lastUsedAt: true, createdAt: true, revokedAt: true },
  });
  res.json({ keys });
});

const createKeySchema = z.object({ label: z.string().min(1).max(100) });

/** The raw key is returned exactly once, here, and never again — same UX pattern as GitHub personal access tokens. */
apiKeysRouter.post('/api-keys', async (req: AuthedRequest, res) => {
  const parsed = createKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const key = await prisma.apiKey.create({
    data: { userId: req.user!.id, label: parsed.data.label, keyHash, keyPrefix },
  });

  res.status(201).json({
    key: { id: key.id, label: key.label, keyPrefix: key.keyPrefix, createdAt: key.createdAt },
    rawKey,
  });
});

apiKeysRouter.delete('/api-keys/:id', async (req: AuthedRequest, res) => {
  const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
  if (!key) return res.status(404).json({ error: 'Key not found' });
  if (!(await canAccessResource(key.userId, req))) {
    return res.status(404).json({ error: 'Key not found' });
  }

  if (key.revokedAt) {
    return res.status(400).json({ error: 'API key is already revoked' });
  }

  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});
