import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

export const cmsRouter = Router();

/**
 * Public — the marketing site fetches this at request time with no auth,
 * the same way it fetches the services catalog. Returns a flat
 * { [key]: value } map for the page; the site falls back to its own
 * hardcoded defaults for any key that's never been set, so an empty CMS
 * doesn't mean a broken page.
 */
cmsRouter.get('/cms/:page', async (req, res) => {
  const blocks = await prisma.contentBlock.findMany({ where: { page: req.params.page } });
  const content: Record<string, unknown> = {};
  for (const block of blocks) {
    content[block.key] = block.valueJson;
  }
  res.json({ page: req.params.page, content });
});

const upsertSchema = z.object({
  blocks: z.array(z.object({ key: z.string().min(1), value: z.unknown() })),
});

/** Admin-only — replaces (or creates) one or more keys for a page in one call. */
cmsRouter.put('/cms/:page', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const page = req.params.page;

  await Promise.all(
    parsed.data.blocks.map((block) =>
      prisma.contentBlock.upsert({
        where: { page_key: { page, key: block.key } },
        create: { page, key: block.key, valueJson: block.value as object },
        update: { valueJson: block.value as object },
      })
    )
  );

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'cms.update', target: page },
  });

  const blocks = await prisma.contentBlock.findMany({ where: { page } });
  const content: Record<string, unknown> = {};
  for (const block of blocks) content[block.key] = block.valueJson;

  res.json({ page, content });
});
