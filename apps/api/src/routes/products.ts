import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';

/**
 * The category-aware product catalog (Product + Plan). Superseded the flat
 * `Service` model — see packages/db/scripts/migrate-services-to-products.ts
 * for the one-off backfill and Phase 1 delivery notes for context. Legacy
 * `/services` routes keep working untouched; new checkout flows should use
 * this instead.
 */
export const productsRouter = Router();

const CATEGORIES = [
  'web_hosting',
  'node_app_hosting',
  'python_app_hosting',
  'discordbot_node',
  'discordbot_python',
  'whatsappbot_hosting',
  'lavalink_hosting',
  'vps',
  'ai_subscription',
  'smtp_hosting',
  'database_hosting',
  'app_catalog',
] as const;

const BILLING_TYPES = ['one_time', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;

// ── Public read — no auth, customers need to browse before signing in ─────
productsRouter.get('/products', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category ? { category: category as (typeof CATEGORIES)[number] } : {}),
    },
    include: { plans: { where: { isActive: true }, orderBy: { price: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ products });
});

productsRouter.get('/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { plans: { orderBy: { price: 'asc' } } },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// ── Admin/dev-managed CRUD ──────────────────────────────────────────────────
productsRouter.use(requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const productSchema = z.object({
  category: z.enum(CATEGORIES),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

productsRouter.post('/products', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let n = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  const product = await prisma.product.create({
    data: { ...parsed.data, slug },
    include: { plans: true },
  });

  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'product.create', target: product.id } });
  res.status(201).json({ product });
});

productsRouter.put('/products/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const product = await prisma.product
    .update({ where: { id: req.params.id }, data: parsed.data, include: { plans: true } })
    .catch(() => null);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'product.update', target: product.id } });
  res.json({ product });
});

productsRouter.delete('/products/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  try {
    // Delete linked plans first if they have no order constraints
    await prisma.plan.deleteMany({ where: { productId: req.params.id } }).catch(() => null);
    await prisma.product.delete({ where: { id: req.params.id } });
    await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'product.delete', target: req.params.id } });
    return res.json({ ok: true, deleted: true, message: 'Product deleted successfully.' });
  } catch (err: any) {
    // If deletion fails due to existing orders/subscriptions (FK constraint), deactivate instead of failing
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    }).catch(() => null);
    await prisma.plan.updateMany({
      where: { productId: req.params.id },
      data: { isActive: false },
    }).catch(() => null);

    await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'product.deactivate', target: req.params.id } });
    return res.json({
      ok: true,
      deactivated: true,
      message: 'Product has existing order history, so it was deactivated instead of hard-deleted.',
    });
  }
});

const planSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().nonnegative(),
  currency: z.enum(['LKR', 'USD']).optional().default('LKR'),
  billingType: z.enum(BILLING_TYPES),
  specsJson: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

productsRouter.post('/products/:productId/plans', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { specsJson, ...rest } = parsed.data;
  const plan = await prisma.plan.create({
    data: {
      ...rest,
      specsJson: specsJson === null ? undefined : (specsJson as any),
      productId: product.id,
    },
  });

  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'plan.create', target: plan.id } });
  res.status(201).json({ plan });
});

productsRouter.put('/plans/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { specsJson, ...rest } = parsed.data;
  const plan = await prisma.plan.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      specsJson: specsJson === null ? undefined : (specsJson as any),
    },
  }).catch(() => null);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'plan.update', target: plan.id } });
  res.json({ plan });
});

productsRouter.delete('/plans/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const plan = await prisma.plan
    .update({ where: { id: req.params.id }, data: { isActive: false } })
    .catch(() => null);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  // Deactivate rather than hard-delete — historical OrderItems reference
  // this Plan and must keep resolving for order history/invoices.
  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'plan.deactivate', target: plan.id } });
  res.json({ ok: true, plan });
});
