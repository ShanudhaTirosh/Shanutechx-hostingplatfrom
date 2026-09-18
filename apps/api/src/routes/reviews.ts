import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

export const reviewsRouter = Router();

// Realistic initial seed reviews with specific product names
const SEED_REVIEWS = [
  {
    authorName: 'Kasun Perera',
    authorRole: 'Full-Stack Developer',
    rating: 5,
    comment: 'Migrated 12 Node.js microservices and PostgreSQL databases to STX HOSTING. 99.99% uptime and sub-20ms latency across Sri Lanka and Asia.',
    productCategory: 'vps',
    productName: 'Cloud VPS KVM - 4 vCPU 8GB RAM',
    isVerified: true,
  },
  {
    authorName: 'Dinesh Wickramasinghe',
    authorRole: 'Discord Bot Developer',
    rating: 5,
    comment: 'Our 24/7 Discord bot with 50,000+ members runs flawlessly. Zero dropouts, automatic reboot on memory spikes, and super responsive support.',
    productCategory: 'bot_hosting',
    productName: 'Discord Bot Python Daemon 2GB',
    isVerified: true,
  },
  {
    authorName: 'Tharindu Fernando',
    authorRole: 'DevOps Engineer',
    rating: 5,
    comment: 'The Cloud VPS allocations and 1-Click App Catalog saved us weeks of setup time. Instant provisioning upon payment approval is unbeatable.',
    productCategory: 'vps',
    productName: 'Cloud VPS KVM - 8 vCPU 16GB RAM',
    isVerified: true,
  },
  {
    authorName: 'Nimesha Jayasinghe',
    authorRole: 'E-commerce Founder',
    rating: 5,
    comment: 'Switched our Next.js storefront to STX Web App Hosting. Page load speed dropped from 2.4s to 420ms. Incredible value!',
    productCategory: 'web_hosting',
    productName: 'Next.js & Node Container Hosting',
    isVerified: true,
  },
  {
    authorName: 'Sahan Alwis',
    authorRole: 'SaaS Builder',
    rating: 5,
    comment: 'Managed PostgreSQL & Redis clusters operate effortlessly. Automated Cloudflare R2 backups give us 100% peace of mind.',
    productCategory: 'database_hosting',
    productName: 'Managed PostgreSQL HA Cluster',
    isVerified: true,
  },
  {
    authorName: 'Ruvini Silva',
    authorRole: 'Community Lead',
    rating: 5,
    comment: 'WhatsApp and Telegram bot daemons run 24/7 with zero downtime. Payment verification was instant via Commercial Bank online transfer.',
    productCategory: 'bot_hosting',
    productName: 'WhatsApp Baileys Gateway Daemon',
    isVerified: true,
  },
];

/** Ensure initial seed reviews exist if database table is empty */
async function ensureSeedReviews() {
  try {
    const count = await prisma.review.count();
    if (count === 0) {
      for (const item of SEED_REVIEWS) {
        await prisma.review.create({ data: item });
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to seed initial reviews');
  }
}

// BUG-M05 FIX: Exported so it can be called once at startup from index.ts
// instead of running a DB COUNT query on every public GET /api/reviews request.
export { ensureSeedReviews };

/**
 * GET /api/reviews
 * Public paginated review list with category filter
 */
reviewsRouter.get('/reviews', async (req: Request, res: Response) => {
  // BUG-M05 FIX: Seed check removed from hot path — now called once at startup.

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 6));
  const category = (req.query.category as string) || undefined;

  const where: any = {};
  if (category && category !== 'all') {
    where.productCategory = category;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.review.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.json({
    reviews,
    total,
    page,
    limit,
    totalPages,
  });
});

/**
 * GET /api/reviews/purchased-items
 * Returns ONLY the specific products/plans/services the logged-in customer has purchased.
 * Admin/Dev gets access to all products for manual review creation.
 */
reviewsRouter.get('/reviews/purchased-items', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'admin' || req.user!.role === 'dev';

  if (isAdmin) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { plans: true },
    });

    const items = products.flatMap((p) =>
      p.plans.map((plan) => ({
        id: plan.id,
        name: `${p.name} (${plan.name})`,
        category: p.category,
      }))
    );

    if (items.length === 0) {
      items.push(
        { id: 'vps_std', name: 'Cloud VPS KVM - Standard 4GB', category: 'vps' },
        { id: 'app_node', name: 'Next.js & Node App Hosting', category: 'web_hosting' },
        { id: 'bot_python', name: '24/7 Discord & WhatsApp Bot Hosting', category: 'bot_hosting' },
        { id: 'db_postgres', name: 'Managed PostgreSQL & Redis Database', category: 'database' },
        { id: 'catalog_app', name: '1-Click App Catalog Deployment', category: 'app_catalog' }
      );
    }

    return res.json({
      purchasedItems: items,
      hasPurchases: true,
      isAdmin: true,
    });
  }

  // Customer purchase lookup across Paid Orders & Active Subscriptions
  const [paidOrders, activeSubs] = await Promise.all([
    prisma.order.findMany({
      where: { userId, status: 'paid' },
      include: {
        items: {
          include: {
            plan: { include: { product: true } },
            service: true,
          },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { userId, status: 'active' },
      include: {
        orderItem: {
          include: {
            plan: { include: { product: true } },
            service: true,
          },
        },
      },
    }),
  ]);

  const purchasedMap = new Map<string, { id: string; name: string; category: string }>();

  // Extract from paid order items
  for (const order of paidOrders) {
    for (const item of order.items) {
      if (item.plan) {
        const key = item.plan.id;
        purchasedMap.set(key, {
          id: key,
          name: `${item.plan.product?.name || 'Cloud Service'} - ${item.plan.name}`,
          category: item.plan.product?.category || 'general',
        });
      } else if (item.service) {
        const key = item.service.id;
        purchasedMap.set(key, {
          id: key,
          name: item.service.name,
          category: 'vps',
        });
      }
    }
  }

  // Extract from active subscriptions
  for (const sub of activeSubs) {
    const item = sub.orderItem;
    if (item?.plan) {
      const key = item.plan.id;
      purchasedMap.set(key, {
        id: key,
        name: `${item.plan.product?.name || 'Cloud Service'} - ${item.plan.name}`,
        category: item.plan.product?.category || 'general',
      });
    } else if (item?.service) {
      const key = item.service.id;
      purchasedMap.set(key, {
        id: key,
        name: item.service.name,
        category: 'vps',
      });
    }
  }

  const purchasedItems = Array.from(purchasedMap.values());
  const hasPurchases = purchasedItems.length > 0;

  res.json({
    purchasedItems,
    hasPurchases,
    isAdmin: false,
  });
});

const createReviewSchema = z.object({
  authorName: z.string().min(2, 'Name is required'),
  authorRole: z.string().optional().default('Verified Client'),
  rating: z.number().min(1).max(5).default(5),
  comment: z.string().min(10, 'Comment must be at least 10 characters'),
  productCategory: z.string().default('general'),
  productName: z.string().optional(),
  productId: z.string().optional(),
});

/**
 * POST /api/reviews
 * Creates a review ONLY for an item/category that the logged-in customer has actually purchased.
 */
reviewsRouter.post('/reviews', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const isAdmin = req.user!.role === 'admin' || req.user!.role === 'dev';

  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // STRICT ITEM-LEVEL PURCHASE VERIFICATION CHECK FOR CUSTOMERS
  if (!isAdmin) {
    const [paidOrders, activeSubs] = await Promise.all([
      prisma.order.findMany({
        where: { userId, status: 'paid' },
        include: {
          items: {
            include: {
              plan: { include: { product: true } },
              service: true,
            },
          },
        },
      }),
      prisma.subscription.findMany({
        where: { userId, status: 'active' },
        include: {
          orderItem: {
            include: {
              plan: { include: { product: true } },
              service: true,
            },
          },
        },
      }),
    ]);

    const hasAnyPaidOrder = paidOrders.length > 0 || activeSubs.length > 0;
    if (!hasAnyPaidOrder) {
      return res.status(403).json({
        error: 'Access Denied: Only customers with paid orders or active cloud subscriptions can write a review.',
        code: 'NO_PURCHASES',
      });
    }

    // Check if customer purchased the specific item/category
    let matchingPurchase = false;
    const targetId = parsed.data.productId;

    for (const order of paidOrders) {
      for (const item of order.items) {
        if (
          (targetId && (item.planId === targetId || item.serviceId === targetId)) ||
          (parsed.data.productName && item.plan?.name.toLowerCase() === parsed.data.productName.toLowerCase())
        ) {
          matchingPurchase = true;
          break;
        }
      }
      if (matchingPurchase) break;
    }

    if (!matchingPurchase) {
      for (const sub of activeSubs) {
        const item = sub.orderItem;
        if (targetId && (item?.planId === targetId || item?.serviceId === targetId)) {
          matchingPurchase = true;
          break;
        }
      }
    }

    if (!matchingPurchase) {
      return res.status(403).json({
        error: 'Item Purchase Required: You can only post a review for an exact item you have actually purchased.',
        code: 'UNMATCHED_PRODUCT_PURCHASE',
      });
    }
  }

  // Prevent duplicate reviews by the same customer for the same product/item
  if (parsed.data.productId) {
    const existingReview = await prisma.review.findFirst({
      where: { userId, productId: parsed.data.productId },
    });
    if (existingReview) {
      return res.status(409).json({ error: 'You have already submitted a review for this product.' });
    }
  }

  const review = await prisma.review.create({
    data: {
      userId,
      authorName: parsed.data.authorName || userEmail.split('@')[0],
      authorRole: parsed.data.authorRole || 'Verified Client',
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      productCategory: parsed.data.productCategory,
      productName: parsed.data.productName || 'Cloud VPS & App Hosting',
      productId: parsed.data.productId || null,
      isVerified: true,
    },
  });

  res.status(201).json({
    message: 'Review published successfully! Thank you for your verified feedback.',
    review,
  });
});

const adminCreateReviewSchema = z.object({
  authorName: z.string().min(2),
  authorRole: z.string().default('Verified Client'),
  rating: z.number().min(1).max(5).default(5),
  comment: z.string().min(5),
  productCategory: z.string().default('vps'),
  productName: z.string().optional(),
  isVerified: z.boolean().default(true),
});

/**
 * POST /api/admin/reviews
 * Admin endpoint to manually create customer reviews for marketing or imported feedback
 */
reviewsRouter.post('/admin/reviews', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = adminCreateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const review = await prisma.review.create({
    data: {
      authorName: parsed.data.authorName,
      authorRole: parsed.data.authorRole,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      productCategory: parsed.data.productCategory,
      productName: parsed.data.productName || 'Cloud Hosting Node',
      isVerified: parsed.data.isVerified,
    },
  });

  res.status(201).json({
    message: 'Admin manual review created successfully.',
    review,
  });
});

/**
 * DELETE /api/admin/reviews/:id
 * Admin endpoint to delete inappropriate reviews
 */
reviewsRouter.delete('/admin/reviews/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.review.delete({ where: { id } });
    res.json({ message: 'Review deleted successfully.' });
  } catch (err) {
    res.status(404).json({ error: 'Review not found.' });
  }
});
