import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

import { syncPanelSettingsToFirebase, syncCmsToFirebase } from '../lib/firebaseSync';
import { withDbFallback, getContactInfoFromFirestore, getCmsPageFromFirestore } from '../lib/firestoreService';

export const cmsRouter = Router();

/**
 * Public — returns structured contact info & platform settings with sensible defaults.
 * Fails over to Firebase Firestore automatically if PostgreSQL is offline.
 */
cmsRouter.get('/cms/contact-info', async (_req, res) => {
  const result = await withDbFallback(
    async () => {
      const blocks = await prisma.contentBlock.findMany({
        where: { page: { in: ['home', 'contact', 'settings'] } },
      });

      const content: Record<string, unknown> = {};
      for (const block of blocks) {
        content[block.key] = block.valueJson;
      }

      return {
        supportEmail: content.supportEmail ?? 'support@shanutechx.cloud',
        contactEmail: content.contactEmail ?? 'sales@shanutechx.cloud',
        contactPhone: content.contactPhone ?? '+1 (800) 589-STX1',
        whatsappPhone: content.whatsappPhone ?? '+94 77 123 4567',
        contactAddress: content.contactAddress ?? 'ShanuTechX Cloud HQ, Tech City, Sri Lanka',
        supportHours: content.supportHours ?? '24/7/365 Tier-3 Engineer Live Support',
        discordUrl: content.discordUrl ?? 'https://discord.gg/shanutechx',
        whatsappChannelUrl: content.whatsappChannelUrl ?? 'https://wa.me/94771234567?text=Hello%20ShanuTechX%20Support',
        telegramUrl: content.telegramUrl ?? 'https://t.me/shanutechx',
        githubUrl: content.githubUrl ?? 'https://github.com/shanutechx',
        twitterUrl: content.twitterUrl ?? 'https://twitter.com/shanutechx',
        facebookUrl: content.facebookUrl ?? 'https://facebook.com/shanutechx',
        companyName: content.companyName ?? 'ShanuTechX Cloud',
        heroTitle: content.heroTitle ?? 'Autonomous High-Performance Cloud Hosting',
        heroSubtitle: content.heroSubtitle ?? 'Deploy web apps, Node.js and Python services, and Discord bots in minutes.',
        announcementText: content.announcementText ?? 'New VPS High-Performance Nodes Online in Ashburn & Frankfurt!',
        announcementActive: content.announcementActive ?? true,
        copyrightText: content.copyrightText ?? `© ${new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.`,
      };
    },
    async () => {
      return await getContactInfoFromFirestore();
    }
  );

  res.json(result);
});

/**
 * Public — the marketing site fetches this at request time with no auth.
 * Returns a flat { [key]: value } map for the page.
 * Fails over to Firebase Firestore if PostgreSQL is offline.
 */
cmsRouter.get('/cms/:page', async (req, res) => {
  const page = req.params.page;

  const result = await withDbFallback(
    async () => {
      const blocks = await prisma.contentBlock.findMany({ where: { page } });
      const content: Record<string, unknown> = {};
      for (const block of blocks) {
        content[block.key] = block.valueJson;
      }
      return { page, content };
    },
    async () => {
      return await getCmsPageFromFirestore(page);
    }
  );

  res.json(result);
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

  // Sync updated CMS settings to Firebase Firestore & Realtime DB
  void syncPanelSettingsToFirebase().catch(() => null);
  void syncCmsToFirebase().catch(() => null);

  const blocks = await prisma.contentBlock.findMany({ where: { page } });
  const content: Record<string, unknown> = {};
  for (const block of blocks) content[block.key] = block.valueJson;

  res.json({ page, content });
});

/** Admin-only — List contact form submissions received from website */
cmsRouter.get('/admin/cms/submissions', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  const blocks = await prisma.contentBlock.findMany({
    where: { page: 'contact_submission' },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const submissions = blocks.map((b) => {
    const val = (b.valueJson as any) || {};
    return {
      key: b.key,
      name: val.name || 'Anonymous',
      email: val.email || '',
      department: val.department || 'General',
      subject: val.subject || '',
      message: val.message || '',
      submittedAt: val.submittedAt || b.updatedAt.toISOString(),
    };
  });

  res.json({ submissions });
});

/** Admin-only — Delete a contact form submission */
cmsRouter.delete('/admin/cms/submissions/:key', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  await prisma.contentBlock.deleteMany({
    where: { page: 'contact_submission', key: req.params.key },
  });

  res.json({ ok: true });
});

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
});

/**
 * Public — Receives contact form submissions from the marketing website.
 */
cmsRouter.post('/cms/contact', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid contact form data', details: parsed.error.flatten() });
  }

  const { name, email, department, subject, message } = parsed.data;
  const submissionKey = `submission_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    await prisma.contentBlock.create({
      data: {
        page: 'contact_submission',
        key: submissionKey,
        valueJson: {
          name,
          email: email.toLowerCase(),
          department: department || 'tech',
          subject: subject || '',
          message,
          submittedAt: new Date().toISOString(),
        },
      },
    });
    res.status(201).json({ ok: true, message: 'Thank you for reaching out. We will get back to you shortly.' });
  } catch (err: any) {
    const { logger } = await import('../lib/logger');
    logger.error({ err, email }, 'Failed to record contact form submission');
    res.status(500).json({ error: 'Failed to process contact submission. Please try again later.' });
  }
});

