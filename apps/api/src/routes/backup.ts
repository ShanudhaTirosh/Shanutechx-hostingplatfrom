import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { runBackup } from '../lib/backup';
import { logger } from '../lib/logger';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { verifySharedSecret } from '../lib/gateAuth';

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
 * GET /api/admin/backup/export-zip
 * Exports a full ZIP archive containing all platform data, database tables, and templates.
 * Admin & Dev only.
 */
backupRouter.get('/admin/backup/export-zip', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const archiver = (await import('archiver')).default;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `shanutechx-platform-backup-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err: any) => {
      logger.error({ err }, 'Error during backup archive creation');
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // Collect database exports in JSON format
    const [users, orders, products, plans, nodes, deployments, vpsProvisions, databases, auditLogs] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isBanned: true,
          createdAt: true,
          phoneNumber: true,
          discordUserId: true,
        },
      }),
      prisma.order.findMany({
        include: { items: true, payments: true },
        take: 1000,
      }),
      prisma.product.findMany({ include: { plans: true } }),
      prisma.plan.findMany(),
      prisma.node.findMany({
        select: { id: true, label: true, ip: true, cpuCores: true, ramMb: true, diskGb: true, isActive: true },
      }),
      prisma.deployment.findMany({ take: 500 }),
      prisma.vpsProvision.findMany({ take: 500 }),
      prisma.managedDatabase.findMany({ take: 500 }),
      prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
    ]);

    const manifest = {
      platform: 'ShanuTechX Cloud Hosting',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.email,
      version: '1.0.0',
      recordCounts: {
        users: users.length,
        orders: orders.length,
        products: products.length,
        plans: plans.length,
        nodes: nodes.length,
        deployments: deployments.length,
        vpsProvisions: vpsProvisions.length,
        databases: databases.length,
        auditLogs: auditLogs.length,
      },
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(users, null, 2), { name: 'database/users.json' });
    archive.append(JSON.stringify(orders, null, 2), { name: 'database/orders.json' });
    archive.append(JSON.stringify(products, null, 2), { name: 'database/products.json' });
    archive.append(JSON.stringify(plans, null, 2), { name: 'database/plans.json' });
    archive.append(JSON.stringify(nodes, null, 2), { name: 'database/nodes.json' });
    archive.append(JSON.stringify(deployments, null, 2), { name: 'database/deployments.json' });
    archive.append(JSON.stringify(vpsProvisions, null, 2), { name: 'database/vps_provisions.json' });
    archive.append(JSON.stringify(databases, null, 2), { name: 'database/managed_databases.json' });
    archive.append(JSON.stringify(auditLogs, null, 2), { name: 'database/audit_logs.json' });

    // Also include template files if directory exists
    const templatesDir = path.resolve(process.cwd(), 'templates');
    if (fs.existsSync(templatesDir)) {
      archive.directory(templatesDir, 'templates');
    }

    await archive.finalize();
  } catch (err: any) {
    logger.error({ err }, 'Backup zip export failed');
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to generate backup zip' });
    }
  }
});

/**
 * POST /api/cron/backup
 * Called by an external cron scheduler (e.g. Vercel Cron, GitHub Actions,
 * or crontab on the server) at midnight daily.
 * Protected by BILLING_CRON_SECRET (same secret used for billing cron).
 */

backupRouter.post('/cron/backup', async (req, res) => {
  const isCronAuthed = verifySharedSecret(req.headers['x-cron-secret'], env.billingCronSecret);

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
