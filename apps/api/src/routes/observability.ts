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

/** GET /api/admin/observability/loki/logs — Search live Loki log streams with native platform log fallback */
observabilityRouter.get('/observability/loki/logs', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '{app=~".+"}';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;

    const lokiClient = new LokiClient(lokiBaseUrl);
    let result = await lokiClient.queryLogs(query, limit);

    // If Loki is unconfigured or has 0 entries, generate native platform telemetry logs from Prisma AuditLogs & Events
    if (!result.isConfigured || result.status !== 'connected' || result.entries.length === 0) {
      const [auditLogs, deployments, nodes, vpsItems] = await Promise.all([
        prisma.auditLog.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: { email: true } } },
        }),
        prisma.deployment.findMany({
          take: 25,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true, subdomain: true, frameworkPreset: true },
        }),
        prisma.node.findMany({
          take: 15,
          select: { id: true, label: true, ip: true, isActive: true, cpuUsedPct: true, ramUsedMb: true, lastSeenAt: true },
        }),
        prisma.vpsProvision.findMany({
          take: 15,
          orderBy: { createdAt: 'desc' },
          select: { id: true, provider: true, ip: true, status: true, createdAt: true },
        }),
      ]);

      const nativeEntries: any[] = [];

      // Map Audit logs
      for (const log of auditLogs) {
        nativeEntries.push({
          id: `platform-audit-${log.id}`,
          timestamp: log.createdAt.toISOString(),
          level: log.action.includes('ban') || log.action.includes('reset') ? 'warn' : 'info',
          source: 'platform-api',
          message: `[AUDIT] Action '${log.action}' performed by ${log.admin?.email || 'admin'} on target: ${log.target || 'system'}`,
          metadata: { action: log.action, admin: log.admin?.email || '' },
        });
      }

      // Map Deployments
      for (const d of deployments) {
        const name = d.subdomain || d.id;
        nativeEntries.push({
          id: `platform-deploy-${d.id}`,
          timestamp: d.createdAt.toISOString(),
          level: d.status === 'failed' ? 'error' : d.status === 'running' ? 'info' : 'debug',
          source: `deploy-${name}`,
          message: `[DEPLOYMENT] Service '${name}' (${d.frameworkPreset || 'auto'}) state: ${d.status.toUpperCase()}`,
          metadata: { serviceId: d.id, status: d.status },
        });
      }

      // Map Compute Nodes
      for (const n of nodes) {
        const timestamp = n.lastSeenAt ? n.lastSeenAt.toISOString() : new Date().toISOString();
        nativeEntries.push({
          id: `platform-node-${n.id}`,
          timestamp,
          level: !n.isActive ? 'warn' : 'info',
          source: `node-${n.label}`,
          message: `[NODE TELEMETRY] Host ${n.label} (${n.ip}) — Status: ${n.isActive ? 'ONLINE' : 'OFFLINE'} | CPU: ${n.cpuUsedPct || 0}% | RAM: ${n.ramUsedMb || 0}MB`,
          metadata: { nodeIp: n.ip, active: String(n.isActive) },
        });
      }

      // Map VPS provisions
      for (const v of vpsItems) {
        nativeEntries.push({
          id: `platform-vps-${v.id}`,
          timestamp: v.createdAt.toISOString(),
          level: v.status === 'pending' ? 'warn' : 'info',
          source: `vps-${v.provider || 'leaseweb'}`,
          message: `[VPS FLEET] VPS (${v.ip || 'Pending IP'}) status: ${v.status.toUpperCase()} (${v.provider})`,
          metadata: { vpsId: v.id, ip: v.ip || '' },
        });
      }

      // Filter native entries by query search string if provided
      let searchKeyword = query.replace(/^\{.*?\}\s*/, '').trim().toLowerCase();
      if (!searchKeyword && query.includes('=')) {
        // Extract value from LogQL syntax like {app="api"} or {source="node"}
        const match = query.match(/="?([^"}]+)"?/);
        if (match && match[1] && match[1] !== '.+') {
          searchKeyword = match[1].toLowerCase();
        }
      }

      let filteredNative = nativeEntries;
      if (searchKeyword) {
        filteredNative = filteredNative.filter((entry) =>
          entry.message.toLowerCase().includes(searchKeyword) ||
          entry.source.toLowerCase().includes(searchKeyword) ||
          entry.level.toLowerCase().includes(searchKeyword)
        );
      }

      const reqLevel = typeof req.query.level === 'string' ? req.query.level : 'all';
      if (reqLevel !== 'all') {
        filteredNative = filteredNative.filter((entry) => entry.level === reqLevel);
      }

      // Sort newest first
      filteredNative.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      result = {
        isConfigured: result.isConfigured,
        status: result.isConfigured ? result.status : 'active_platform_telemetry',
        totalLines: filteredNative.length,
        entries: filteredNative.slice(0, limit),
      };
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to query logs' });
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
