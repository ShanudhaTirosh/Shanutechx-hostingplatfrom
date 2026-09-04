import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { syncKnowledgeBaseToFirebase } from '../lib/firebaseSync';
import { withDbFallback, getKbArticlesFromFirestore, getKbArticleByIdFromFirestore } from '../lib/firestoreService';

/**
 * Knowledge Base API endpoints.
 */

export const knowledgebaseRouter = Router();

const CATEGORY_SLUGS = ['deployments', 'vps', 'databases', 'domains', 'billing', 'api', 'troubleshooting'] as const;

function serializeArticle(a: { category: { slug: string } } & Record<string, any>) {
  const { category, categoryId, ...rest } = a;
  return { ...rest, category: category.slug };
}

// GET /api/knowledgebase - Authenticated: List categories & articles
// Automatically fails over to Firebase Firestore if PostgreSQL is offline
knowledgebaseRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { category, q, targetRole } = req.query;
  const categoryStr = typeof category === 'string' ? category : undefined;
  const searchStr = typeof q === 'string' ? q : undefined;
  const targetRoleStr = typeof targetRole === 'string' ? targetRole : undefined;

  const result = await withDbFallback(
    async () => {
      const where: any = { published: true };
      if (categoryStr && categoryStr !== 'all') {
        where.category = { slug: categoryStr };
      }
      if (targetRoleStr && targetRoleStr !== 'all') {
        where.OR = [
          { targetRole: targetRoleStr },
          { targetRole: 'all' },
          { targetRole: null },
        ];
      }
      if (searchStr && searchStr.trim()) {
        const searchConditions = [
          { title: { contains: searchStr, mode: 'insensitive' } },
          { summary: { contains: searchStr, mode: 'insensitive' } },
          { content: { contains: searchStr, mode: 'insensitive' } },
        ];
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: searchConditions },
          ];
          delete where.OR;
        } else {
          where.OR = searchConditions;
        }
      }

      const [categories, articles] = await Promise.all([
        prisma.kbCategory.findMany({ orderBy: { name: 'asc' } }),
        prisma.kbArticle.findMany({ where, include: { category: true }, orderBy: { updatedAt: 'desc' } }),
      ]);

      return {
        categories,
        articles: articles.map(serializeArticle),
        total: articles.length,
      };
    },
    async () => {
      return await getKbArticlesFromFirestore(categoryStr, searchStr, targetRoleStr);
    }
  );

  res.json(result);
});

// GET /api/knowledgebase/articles/:id - Read single article & increment view count
// Automatically fails over to Firebase Firestore if PostgreSQL is offline
knowledgebaseRouter.get('/articles/:id', requireAuth, async (req: Request, res: Response) => {
  const idOrSlug = req.params.id;

  const article = await withDbFallback(
    async () => {
      const found = await prisma.kbArticle.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: { category: true },
      });
      if (!found) return null;

      const updated = await prisma.kbArticle.update({
        where: { id: found.id },
        data: { views: { increment: 1 } },
        include: { category: true },
      });
      return serializeArticle(updated);
    },
    async () => {
      return await getKbArticleByIdFromFirestore(idOrSlug);
    }
  );

  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json({ article });
});

// POST /api/knowledgebase/articles/:id/helpful - Vote article as helpful
knowledgebaseRouter.post('/articles/:id/helpful', requireAuth, async (req: Request, res: Response) => {
  const article = await prisma.kbArticle.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const updated = await prisma.kbArticle.update({
    where: { id: req.params.id },
    data: { helpfulCount: { increment: 1 } },
    include: { category: true },
  });

  res.json({ article: serializeArticle(updated) });
});

// Admin Schema
const articleSchema = z.object({
  title: z.string().min(3),
  category: z.enum(CATEGORY_SLUGS),
  summary: z.string().min(5),
  content: z.string().min(10),
  targetRole: z.enum(['all', 'customer', 'support', 'dev', 'admin']).optional().default('customer'),
  published: z.boolean().default(true),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// POST /api/knowledgebase/articles - Admin: Create article
knowledgebaseRouter.post('/articles', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parse = articleSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid article data', details: parse.error.format() });
  }

  const category = await prisma.kbCategory.findUnique({ where: { slug: parse.data.category } });
  if (!category) return res.status(400).json({ error: `Unknown category "${parse.data.category}"` });

  const baseSlug = slugify(parse.data.title);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.kbArticle.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const newArticle = await prisma.kbArticle.create({
    data: {
      slug,
      title: parse.data.title,
      categoryId: category.id,
      summary: parse.data.summary,
      content: parse.data.content,
      published: parse.data.published,
    },
    include: { category: true },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'kb.article.create', target: newArticle.id },
  });

  void syncKnowledgeBaseToFirebase().catch(() => null);

  res.status(201).json({ article: serializeArticle(newArticle) });
});

// PUT /api/knowledgebase/articles/:id - Admin: Update article
knowledgebaseRouter.put('/articles/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const existing = await prisma.kbArticle.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Article not found' });

  const parse = articleSchema.partial().safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid article data', details: parse.error.format() });
  }

  const { category: categorySlug, ...rest } = parse.data;
  const data: any = { ...rest };
  if (categorySlug) {
    const category = await prisma.kbCategory.findUnique({ where: { slug: categorySlug } });
    if (!category) return res.status(400).json({ error: `Unknown category "${categorySlug}"` });
    data.categoryId = category.id;
  }

  const updated = await prisma.kbArticle.update({
    where: { id: req.params.id },
    data,
    include: { category: true },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'kb.article.update', target: updated.id },
  });

  void syncKnowledgeBaseToFirebase().catch(() => null);

  res.json({ article: serializeArticle(updated) });
});

// DELETE /api/knowledgebase/articles/:id - Admin: Delete article
knowledgebaseRouter.delete('/articles/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const existing = await prisma.kbArticle.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Article not found' });

  await prisma.kbArticle.delete({ where: { id: req.params.id } });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'kb.article.delete', target: req.params.id },
  });

  void syncKnowledgeBaseToFirebase().catch(() => null);

  res.json({ success: true });
});
