import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { runUptimeChecks } from '../lib/uptimeMonitor';
import { env } from '../env';

export const statusRouter = Router();

/**
 * Public — no auth. Aggregates platform-wide incidents (manually posted by
 * an admin) and a rollup of the most recent uptime checks across all
 * public deployments, so a visitor can see "is SHANUTECHX itself healthy"
 * without needing to know about any specific customer's deployment.
 */
statusRouter.get('/status', async (_req, res) => {
  const [incidents, recentChecks] = await Promise.all([
    prisma.statusIncident.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    prisma.uptimeCheck.findMany({ orderBy: { checkedAt: 'desc' }, take: 500 }),
  ]);

  const latestByDeployment = new Map<string, (typeof recentChecks)[number]>();
  for (const check of recentChecks) {
    if (!latestByDeployment.has(check.deploymentId)) {
      latestByDeployment.set(check.deploymentId, check);
    }
  }

  const total = latestByDeployment.size;
  const up = [...latestByDeployment.values()].filter((c) => c.isUp).length;

  res.json({
    overallStatus: total === 0 ? 'unknown' : up === total ? 'operational' : up > 0 ? 'partial_outage' : 'major_outage',
    deploymentsUp: up,
    deploymentsTotal: total,
    incidents,
  });
});

const createIncidentSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(['minor', 'major', 'critical']).default('minor'),
});

statusRouter.post('/status/incidents', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = createIncidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const incident = await prisma.statusIncident.create({ data: parsed.data });
  res.status(201).json({ incident });
});

statusRouter.patch('/status/incidents/:id/resolve', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const incident = await prisma.statusIncident.update({
    where: { id: req.params.id },
    data: { resolvedAt: new Date() },
  });
  res.json({ incident });
});

/**
 * Runs the uptime check sweep. Same dual-trigger pattern as
 * /api/billing/run-checks: an admin button in the dashboard, or a
 * scheduled job hitting this with a shared secret.
 */
statusRouter.post('/status/run-checks', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  const isCronAuthed = (() => {
    if (typeof cronSecret !== 'string') return false;
    // Always compare fixed-length HMAC digests to avoid leaking the secret
    // length via a short-circuit length check.
    const submitted = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(cronSecret).digest();
    const expected = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(env.billingCronSecret).digest();
    return crypto.timingSafeEqual(submitted, expected);
  })();

  if (!isCronAuthed) {
    return requireAuth(req as AuthedRequest, res, async () => {
      const role = (req as AuthedRequest).user?.role;
      if (role !== 'admin' && role !== 'dev') {
        return res.status(403).json({ error: 'Admin or dev access required' });
      }
      const result = await runUptimeChecks();
      res.json(result);
    });
  }

  const result = await runUptimeChecks();
  res.json(result);
});

/** Per-deployment uptime history for the owning customer (or admin). */
statusRouter.get('/deployments/:id/uptime', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Not found' });
  if (req.user!.role !== 'admin' && deployment.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Not found' });
  }

  const checks = await prisma.uptimeCheck.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { checkedAt: 'desc' },
    take: 100,
  });

  const upCount = checks.filter((c: { isUp: boolean }) => c.isUp).length;
  const uptimePct = checks.length ? Math.round((upCount / checks.length) * 1000) / 10 : null;

  res.json({ checks, uptimePct });
});
