import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { runUptimeChecks } from '../lib/uptimeMonitor';
import { env } from '../env';
import { verifySharedSecret } from '../lib/gateAuth';

export const statusRouter = Router();

const DEFAULT_SYSTEM_COMPONENTS = [
  {
    name: 'API Gateway & Auth',
    group: 'Core Platform',
    description: 'OAuth, JWT verification, and core API request routing',
    order: 1,
  },
  {
    name: 'Control Panel & Dashboard Studio',
    group: 'Core Platform',
    description: 'Next.js web console and administrative control surface',
    order: 2,
  },
  {
    name: 'Managed PostgreSQL & MySQL Engine',
    group: 'Databases & Storage',
    description: 'High-availability relational database cluster',
    order: 3,
  },
  {
    name: 'VPS Fleet & Docker Edge Compute',
    group: 'Compute Nodes',
    description: 'Distributed container runtime nodes & Traefik edge proxy',
    order: 4,
  },
  {
    name: 'Cloudflare R2 & Workspace Storage',
    group: 'Databases & Storage',
    description: 'Object storage buckets and snapshot backup vault',
    order: 5,
  },
  {
    name: 'Hostinger & Postal SMTP Relay',
    group: 'Email & Messaging',
    description: 'Transactional email dispatcher and webmail engine',
    order: 6,
  },
];

function generate90DayHistory(status: string = 'operational') {
  const days: Array<{ date: string; status: string; uptimePct: number; note?: string }> = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      status: i === 0 ? status : 'operational',
      uptimePct: i === 0 && status !== 'operational' ? 98.5 : 100,
    });
  }
  return days;
}

/**
 * Public — no auth. Returns comprehensive status data for the public status page:
 * - Overall status rollup
 * - 90-day component uptime history & live status
 * - Active & upcoming scheduled maintenance windows
 * - Incident log history
 */
statusRouter.get('/status/public', async (_req, res) => {
  try {
    let components = await prisma.systemComponent.findMany({
      where: { isPublic: true },
      orderBy: { order: 'asc' },
    });

    if (components.length === 0) {
      await Promise.all(
        DEFAULT_SYSTEM_COMPONENTS.map((item) =>
          prisma.systemComponent.create({
            data: {
              name: item.name,
              group: item.group,
              description: item.description,
              order: item.order,
              status: 'operational',
              uptimePct90d: 99.98,
              history90d: generate90DayHistory('operational'),
            },
          })
        )
      );
      components = await prisma.systemComponent.findMany({
        where: { isPublic: true },
        orderBy: { order: 'asc' },
      });
    }

    const [maintenances, incidents, subscriberCount] = await Promise.all([
      prisma.scheduledMaintenance.findMany({
        orderBy: { scheduledStart: 'desc' },
        take: 10,
      }),
      prisma.statusIncident.findMany({
        orderBy: { startedAt: 'desc' },
        take: 30,
      }),
      prisma.statusSubscriber.count({ where: { isActive: true } }),
    ]);

    const statuses = components.map((c) => c.status);
    const activeMaintenance = maintenances.some((m) => m.status === 'in_progress');

    let overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' = 'operational';
    if (statuses.includes('major_outage')) {
      overallStatus = 'major_outage';
    } else if (statuses.includes('partial_outage')) {
      overallStatus = 'partial_outage';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else if (activeMaintenance || statuses.includes('maintenance')) {
      overallStatus = 'maintenance';
    }

    const formattedComponents = components.map((c) => ({
      ...c,
      history90d: Array.isArray(c.history90d) ? c.history90d : generate90DayHistory(c.status),
    }));

    res.json({
      overallStatus,
      components: formattedComponents,
      scheduledMaintenances: maintenances,
      incidents,
      subscriberCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load public status' });
  }
});

/** Existing /api/status route backward-compatibility endpoint */
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
    overallStatus: total === 0 ? 'operational' : up === total ? 'operational' : up > 0 ? 'partial_outage' : 'major_outage',
    deploymentsUp: up,
    deploymentsTotal: total,
    incidents,
  });
});

const subscribeSchema = z.object({
  type: z.enum(['email', 'webhook', 'push']).default('email'),
  target: z.string().min(3),
});

/** Public endpoint to subscribe to platform status events */
statusRouter.post('/status/subscribe', async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { type, target } = parsed.data;

  if (type === 'email' && (!target.includes('@') || !target.includes('.'))) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (type === 'webhook' && !target.startsWith('http://') && !target.startsWith('https://')) {
    return res.status(400).json({ error: 'Please enter a valid HTTP/HTTPS webhook URL' });
  }

  const secretToken = crypto.randomBytes(16).toString('hex');

  const subscriber = await prisma.statusSubscriber.upsert({
    where: { secretToken },
    update: { isActive: true },
    create: {
      type,
      target,
      secretToken,
      isActive: true,
    },
  });

  res.status(201).json({
    ok: true,
    message: `Subscribed successfully to ${type} notifications for SHANUTECHX status updates.`,
    subscriber: {
      id: subscriber.id,
      type: subscriber.type,
      target: subscriber.target,
    },
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

const createMaintenanceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  impact: z.enum(['minor', 'major', 'critical', 'none']).default('minor'),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  affectedComponents: z.array(z.string()).default([]),
});

statusRouter.post('/status/maintenances', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = createMaintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const maintenance = await prisma.scheduledMaintenance.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      impact: parsed.data.impact,
      scheduledStart: new Date(parsed.data.scheduledStart),
      scheduledEnd: new Date(parsed.data.scheduledEnd),
      affectedComponents: parsed.data.affectedComponents,
      status: 'scheduled',
      updates: [
        {
          timestamp: new Date().toISOString(),
          message: 'Maintenance scheduled and announced to public telemetry.',
        },
      ],
    },
  });

  res.status(201).json({ maintenance });
});

statusRouter.patch('/status/maintenances/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { status, updateMessage } = req.body;

  const existing = await prisma.scheduledMaintenance.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Maintenance not found' });

  const currentUpdates = Array.isArray(existing.updates) ? existing.updates : [];
  if (updateMessage) {
    currentUpdates.unshift({
      timestamp: new Date().toISOString(),
      message: updateMessage,
    });
  }

  const updated = await prisma.scheduledMaintenance.update({
    where: { id: req.params.id },
    data: {
      ...(status ? { status } : {}),
      updates: currentUpdates,
    },
  });

  res.json({ maintenance: updated });
});

statusRouter.put('/status/components/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { status, description, uptimePct90d } = req.body;

  const existing = await prisma.systemComponent.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Component not found' });

  const history = generate90DayHistory(status || existing.status);

  const updated = await prisma.systemComponent.update({
    where: { id: req.params.id },
    data: {
      ...(status ? { status } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(uptimePct90d !== undefined ? { uptimePct90d: parseFloat(uptimePct90d) } : {}),
      history90d: history,
    },
  });

  res.json({ component: updated });
});

statusRouter.post('/status/run-checks', async (req, res) => {
  const isCronAuthed = verifySharedSecret(req.headers['x-cron-secret'], env.billingCronSecret);

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

statusRouter.get('/deployments/:id/uptime', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Not found' });
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && deployment.userId !== req.user!.id) {
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

