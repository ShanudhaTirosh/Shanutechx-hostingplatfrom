import { Router } from 'express';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { runBackup } from '../lib/backup';
import { logger } from '../lib/logger';
import { env } from '../env';
import { prisma } from '../lib/prisma';

export const backupRouter = Router();

/**
 * POST /api/admin/backup/run
 * Triggers a manual database backup to R2. Admin-only.
 */
backupRouter.post('/admin/backup/run', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const start = Date.now();
  try {
    const result = await runBackup();
    await prisma.backupRun.create({
      data: {
        triggeredBy: `manual:${req.user!.id}`,
        success: true,
        r2Key: result.key,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      },
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error({ err }, 'Manual backup trigger failed');
    await prisma.backupRun.create({
      data: {
        triggeredBy: `manual:${req.user!.id}`,
        success: false,
        durationMs: Date.now() - start,
        error: err.message,
      },
    });
    res.status(500).json({ error: err.message });
  }
});

/** History list for the Dev Dashboard -> Backups page. */
backupRouter.get('/admin/backup/history', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  const runs = await prisma.backupRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ runs });
});

/**
 * POST /api/cron/backup
 * Called by an external cron scheduler (e.g. Vercel Cron, GitHub Actions,
 * or crontab on the server) at midnight daily.
 * Protected by BILLING_CRON_SECRET (same secret used for billing cron).
 */
import crypto from 'crypto';

backupRouter.post('/cron/backup', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'] ?? req.query.secret;
  const isCronAuthed = (() => {
    if (typeof cronSecret !== 'string') return false;
    const submitted = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(cronSecret).digest();
    const expected = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(env.billingCronSecret).digest();
    return crypto.timingSafeEqual(submitted, expected);
  })();

  if (!isCronAuthed) {
    return res.status(401).json({ error: 'Invalid cron secret' });
  }

  try {
    const result = await runBackup();
    logger.info(result, 'Cron backup completed');
    await prisma.backupRun.create({
      data: { triggeredBy: 'cron', success: true, r2Key: result.key, sizeBytes: result.sizeBytes, durationMs: result.durationMs },
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error({ err }, 'Cron backup failed');
    await prisma.backupRun.create({
      data: { triggeredBy: 'cron', success: false, error: err.message },
    });
    res.status(500).json({ error: err.message });
  }
});
