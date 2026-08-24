import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

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
knowledgebaseRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { category, q } = req.query;

  const where: any = { published: true };
  if (category && typeof category === 'string' && category !== 'all') {
    where.category = { slug: category };
  }
  if (q && typeof q === 'string' && q.trim()) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [categories, articles] = await Promise.all([
    prisma.kbCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.kbArticle.findMany({ where, include: { category: true }, orderBy: { updatedAt: 'desc' } }),
  ]);

  res.json({
    categories,
    articles: articles.map(serializeArticle),
    total: articles.length,
  });
});

// GET /api/knowledgebase/articles/:id - Read single article & increment view count
knowledgebaseRouter.get('/articles/:id', requireAuth, async (req: Request, res: Response) => {
  const article = await prisma.kbArticle.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    include: { category: true },
  });
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const updated = await prisma.kbArticle.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
    include: { category: true },
  });

  res.json({ article: serializeArticle(updated) });
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

  res.json({ success: true });
});
