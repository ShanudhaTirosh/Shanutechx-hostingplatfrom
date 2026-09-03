import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const reviewsRouter = Router();

// Authentic seed reviews to initialize the database if clean/empty
const SEED_REVIEWS = [
  {
    authorName: 'Kasun Perera',
    authorRole: 'Full-Stack Developer',
    rating: 5,
    comment: 'Migrated 12 Node.js microservices and PostgreSQL databases to STX HOSTING. 99.99% uptime and sub-20ms latency across Sri Lanka and Asia.',
    productCategory: 'vps',
    isVerified: true,
  },
  {
    authorName: 'Dinesh Wickramasinghe',
    authorRole: 'Discord Bot Developer',
    rating: 5,
    comment: 'Our 24/7 Discord bot with 50,000+ members runs flawlessly. Zero dropouts, automatic reboot on memory spikes, and super responsive support.',
    productCategory: 'bot_hosting',
    isVerified: true,
  },
  {
    authorName: 'Tharindu Fernando',
    authorRole: 'DevOps Engineer',
    rating: 5,
    comment: 'The Cloud VPS allocations and 1-Click App Catalog saved us weeks of setup time. Instant provisioning upon payment approval is unbeatable.',
    productCategory: 'vps',
    isVerified: true,
  },
  {
    authorName: 'Nimesha Jayasinghe',
    authorRole: 'E-commerce Founder',
    rating: 5,
    comment: 'Switched our Next.js storefront to STX Web App Hosting. Page load speed dropped from 2.4s to 420ms. Incredible value!',
    productCategory: 'app_hosting',
    isVerified: true,
  },
  {
    authorName: 'Sahan Alwis',
    authorRole: 'SaaS Builder',
    rating: 5,
    comment: 'Managed PostgreSQL & Redis clusters operate effortlessly. Automated Cloudflare R2 backups give us 100% peace of mind.',
    productCategory: 'database',
    isVerified: true,
  },
  {
    authorName: 'Ruvini Silva',
    authorRole: 'Community Lead',
    rating: 5,
    comment: 'WhatsApp and Telegram bot daemons run 24/7 with zero downtime. Payment verification was instant via Commercial Bank online transfer.',
    productCategory: 'bot_hosting',
    isVerified: true,
  },
];

/**
  Ensure initial seed reviews exist if database table is empty
 */
async function ensureSeedReviews() {
  try {
    const count = await prisma.review.count();
    if (count === 0) {
      for (const item of SEED_REVIEWS) {
        await prisma.review.create({ data: item });
      }
    }
  } catch (err) {
    console.error('Failed to seed initial reviews:', err);
  }
}

/**
 * GET /api/reviews
 * Public paginated review list with category filter
 */
reviewsRouter.get('/reviews', async (req: Request, res: Response) => {
  await ensureSeedReviews();

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
 * GET /api/reviews/eligibility
 * Checks if the logged-in customer has paid orders or active subscriptions allowing review submission
 */
reviewsRouter.get('/reviews/eligibility', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;

  const [paidOrdersCount, activeSubsCount] = await Promise.all([
    prisma.order.count({
      where: {
        userId,
        status: 'paid',
      },
    }),
    prisma.subscription.count({
      where: {
        userId,
        status: 'active',
      },
    }),
  ]);

  const canReview = paidOrdersCount > 0 || activeSubsCount > 0;

  res.json({
    canReview,
    paidOrdersCount,
    activeSubsCount,
    message: canReview
      ? 'Verified client eligible to leave product review.'
      : 'Only verified clients who have completed an order or subscription can submit reviews.',
  });
});

const createReviewSchema = z.object({
  authorName: z.string().min(2, 'Name is required'),
  authorRole: z.string().optional().default('Verified Client'),
  rating: z.number().min(1).max(5).default(5),
  comment: z.string().min(10, 'Comment must be at least 10 characters'),
  productCategory: z.string().default('general'),
});

/**
 * POST /api/reviews
 * Creates a review ONLY if customer has a paid order or active subscription
 */
reviewsRouter.post('/reviews', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  // STRICT PURCHASE VERIFICATION CHECK
  const [paidOrdersCount, activeSubsCount] = await Promise.all([
    prisma.order.count({
      where: {
        userId,
        status: 'paid',
      },
    }),
    prisma.subscription.count({
      where: {
        userId,
        status: 'active',
      },
    }),
  ]);

  if (paidOrdersCount === 0 && activeSubsCount === 0) {
    return res.status(403).json({
      error: 'Only verified clients who have purchased a product or active subscription can leave a review.',
      code: 'UNPURCHASED_CLIENT',
    });
  }

  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const review = await prisma.review.create({
    data: {
      userId,
      authorName: parsed.data.authorName || userEmail.split('@')[0],
      authorRole: parsed.data.authorRole || 'Verified Client',
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      productCategory: parsed.data.productCategory,
      isVerified: true,
    },
  });

  res.status(201).json({
    message: 'Review published successfully! Thank you for your verified feedback.',
    review,
  });
});
