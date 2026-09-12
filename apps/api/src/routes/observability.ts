import { Router } from 'express';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { LokiClient } from '../lib/loki';
import { GrafanaClient } from '../lib/grafana';
import { env } from '../env';
import { prisma } from '../lib/prisma';

export const observabilityRouter = Router();

let lokiBaseUrl = env.lokiUrl;
let grafanaBaseUrl = env.grafanaUrl;
let grafanaApiKey = env.grafanaApiKey;

/** GET /api/admin/observability/loki/logs — Search live Loki log streams */
observabilityRouter.get('/observability/loki/logs', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '{app=~".+"}';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;

    const lokiClient = new LokiClient(lokiBaseUrl);
    const result = await lokiClient.queryLogs(query, limit);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to query Loki logs' });
  }
});

/** GET /api/admin/observability/grafana/dashboards — Fetch Grafana dashboard list */
observabilityRouter.get('/observability/grafana/dashboards', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const grafanaClient = new GrafanaClient(grafanaBaseUrl, grafanaApiKey);
    const dashboards = await grafanaClient.fetchDashboards();

    res.json({
      isConfigured: grafanaClient.isConfigured(),
      dashboards,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch Grafana dashboards' });
  }
});

/** GET /api/admin/observability/nodes/:id/telemetry — Fetch Grafana PromQL node metrics */
observabilityRouter.get('/observability/nodes/:id/telemetry', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const node = await prisma.node.findUnique({ where: { id: req.params.id } });
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const grafanaClient = new GrafanaClient(grafanaBaseUrl, grafanaApiKey);
    const telemetry = await grafanaClient.getNodeTelemetry(node.ip);

    res.json({
      nodeId: node.id,
      label: node.label,
      ip: node.ip,
      telemetry,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch node telemetry' });
  }
});
