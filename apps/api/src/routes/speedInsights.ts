import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';

export const speedInsightsRouter = Router();

const recordVitalSchema = z.object({
  deploymentId: z.string().min(1),
  routePath: z.string().min(1).max(500),
  metricName: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  metricValue: z.number().min(0),
  rating: z.enum(['good', 'needs_improvement', 'poor']),
  deviceType: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  country: z.string().max(10).optional(),
});

// POST /api/speed-insights/vitals — Record a Core Web Vital metric (Public telemetry endpoint)
speedInsightsRouter.post('/speed-insights/vitals', async (req, res) => {
  const parsed = recordVitalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const metric = await prisma.speedInsightMetric.create({
    data: {
      deploymentId: parsed.data.deploymentId,
      routePath: parsed.data.routePath,
      metricName: parsed.data.metricName,
      metricValue: parsed.data.metricValue,
      rating: parsed.data.rating,
      deviceType: parsed.data.deviceType || 'desktop',
      country: parsed.data.country || 'SL',
    },
  });

  return res.status(201).json({ ok: true, metricId: metric.id });
});

speedInsightsRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

// GET /api/speed-insights/:deploymentId — Retrieve aggregated Core Web Vitals telemetry
speedInsightsRouter.get('/speed-insights/:deploymentId', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.deploymentId);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const metrics = await prisma.speedInsightMetric.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const pathAggregates: Record<string, { LCP: number[]; INP: number[]; CLS: number[] }> = {};

  for (const m of metrics) {
    if (!pathAggregates[m.routePath]) {
      pathAggregates[m.routePath] = { LCP: [], INP: [], CLS: [] };
    }
    if (m.metricName === 'LCP' || m.metricName === 'INP' || m.metricName === 'CLS') {
      pathAggregates[m.routePath][m.metricName].push(m.metricValue);
    }
  }

  const scores: Record<string, { lcpAvg: number; inpAvg: number; clsAvg: number; count: number }> = {};
  for (const [path, data] of Object.entries(pathAggregates)) {
    const lcpAvg = data.LCP.length ? data.LCP.reduce((a, b) => a + b, 0) / data.LCP.length : 0;
    const inpAvg = data.INP.length ? data.INP.reduce((a, b) => a + b, 0) / data.INP.length : 0;
    const clsAvg = data.CLS.length ? data.CLS.reduce((a, b) => a + b, 0) / data.CLS.length : 0;
    scores[path] = {
      lcpAvg: Number(lcpAvg.toFixed(2)),
      inpAvg: Number(inpAvg.toFixed(2)),
      clsAvg: Number(clsAvg.toFixed(3)),
      count: data.LCP.length + data.INP.length + data.CLS.length,
    };
  }

  return res.json({
    deploymentId: deployment.id,
    subdomain: deployment.subdomain,
    scores,
    totalMetricsCollected: metrics.length,
  });
});
