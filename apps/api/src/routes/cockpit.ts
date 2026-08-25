import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { env } from '../env';
import { logger } from '../lib/logger';
import { issueSshTicket } from '../lib/sshTerminalGateway';

export const cockpitRouter = Router();

cockpitRouter.use(requireAuth);

/**
 * Helper to resolve node or VPS provision IP and check access permissions.
 *
 * RBAC rules:
 *  - Cluster Nodes (platform infra): admin and dev ONLY. No customer access
 *    regardless of VPS ownership — a cluster node serves many customers and
 *    granting OS-level access to a tenant would be catastrophic.
 *  - VPS Provisions (customer VPS): owner or admin/dev via canAccessResource.
 */
async function resolveNodeAccess(req: AuthedRequest, nodeId: string) {
  // 1. Try finding a cluster compute Node
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    include: { projects: true },
  });

  if (node) {
    // Cluster nodes are ONLY accessible by admin and dev staff
    if (req.user!.role === 'admin' || req.user!.role === 'dev') return node;
    // Bug fix: previously granted access to ANY node if user had ANY VPS
    return null;
  }

  // 2. Try finding a customer VPS provision
  const provision = await prisma.vpsProvision.findUnique({ where: { id: nodeId } });
  if (provision) {
    const allowed = await canAccessResource(provision.userId, req);
    if (!allowed) return null;

    let ip: string | null = null;
    if (provision.leasewebVpsId) {
      try {
        const { getVps } = await import('../lib/leasewebClient');
        const vps = await getVps(provision.leasewebVpsId);
        ip = vps.ips?.[0]?.ip || null;
      } catch (err) {
        logger.warn({ err, provisionId: provision.id }, 'Failed to fetch VPS IP from Leaseweb');
      }
    } else if (provision.panelUrl) {
      try {
        const url = new URL(provision.panelUrl);
        ip = url.hostname;
      } catch (err) {
        logger.warn({ err, provisionId: provision.id, panelUrl: provision.panelUrl }, 'Invalid panelUrl on VPS provision');
      }
    }

    if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
      return null; // Refuse invalid or loopback IP fallback
    }

    return {
      id: provision.id,
      label: `vps-${provision.externalId || provision.id.slice(0, 8)}`,
      ip,
    };
  }

  return null;
}

function agentUrl(nodeIp: string, path: string) {
  return `http://${nodeIp}:${env.nodeAgentPort}${path}`;
}

function agentHeaders() {
  return { 'x-agent-secret': env.nodeAgentSecret, 'Content-Type': 'application/json' };
}

// ── 1. SYSTEM MONITORING ───────────────────────────────────────────────────

cockpitRouter.get('/nodes/:nodeId/cockpit/monitoring', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/monitoring'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    logger.error({ err, nodeId: node.id }, 'Failed to fetch cockpit monitoring');
    res.status(502).json({ error: err.message || 'Failed to fetch node monitoring info' });
  }
});

// ── 2. SYSTEMD SERVICE MANAGEMENT ──────────────────────────────────────────

cockpitRouter.get('/nodes/:nodeId/cockpit/services', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/services'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list services' });
  }
});

cockpitRouter.post('/nodes/:nodeId/cockpit/services/action', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { action, serviceName } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/services/action'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ action, serviceName }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'cockpit.service_action',
          target: `${node.id}:${serviceName}:${action}`,
        },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Service action failed' });
  }
});

cockpitRouter.get('/nodes/:nodeId/cockpit/services/logs', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { serviceName, lines } = req.query;
  const path = `/agent/cockpit/services/logs?serviceName=${encodeURIComponent(String(serviceName ?? ''))}&lines=${encodeURIComponent(String(lines ?? 100))}`;

  try {
    const r = await fetch(agentUrl(node.ip, path), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch service logs' });
  }
});

// ── 3. LINUX USER MANAGEMENT ───────────────────────────────────────────────

cockpitRouter.get('/nodes/:nodeId/cockpit/users', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/users'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list Linux users' });
  }
});

cockpitRouter.post('/nodes/:nodeId/cockpit/users', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { username, password } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/users'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.user_create', target: `${node.id}:${username}` },
      });
    }

    res.status(r.ok ? 201 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to create Linux user' });
  }
});

cockpitRouter.delete('/nodes/:nodeId/cockpit/users/:username', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const removeHome = req.query.removeHome ?? 'true';

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/cockpit/users/${encodeURIComponent(req.params.username)}?removeHome=${removeHome}`), {
      method: 'DELETE',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.user_delete', target: `${node.id}:${req.params.username}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to delete Linux user' });
  }
});

cockpitRouter.post('/nodes/:nodeId/cockpit/users/:username/password', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { password } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/cockpit/users/${encodeURIComponent(req.params.username)}/password`), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.user_password_reset', target: `${node.id}:${req.params.username}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to reset password' });
  }
});

// ── 4. DOCKER CONTAINER MANAGEMENT ─────────────────────────────────────────

cockpitRouter.get('/nodes/:nodeId/cockpit/docker/containers', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/docker/containers'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list containers' });
  }
});

cockpitRouter.post('/nodes/:nodeId/cockpit/docker/containers/:containerId/action', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { action } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/cockpit/docker/containers/${encodeURIComponent(req.params.containerId)}/action`), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ action }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.container_action', target: `${node.id}:${req.params.containerId}:${action}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to perform container action' });
  }
});

cockpitRouter.get('/nodes/:nodeId/cockpit/docker/containers/:containerId/logs', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const tail = req.query.tail ? String(req.query.tail) : '200';

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/cockpit/docker/containers/${encodeURIComponent(req.params.containerId)}/logs?tail=${tail}`), {
      headers: agentHeaders(),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch container logs' });
  }
});

// ── 5. UFW FIREWALL CONFIGURATION ──────────────────────────────────────────

cockpitRouter.get('/nodes/:nodeId/cockpit/firewall', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/firewall'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch UFW status' });
  }
});

cockpitRouter.post('/nodes/:nodeId/cockpit/firewall/rules', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { port, protocol, action } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/cockpit/firewall/rules'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ port, protocol, action }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.firewall_rule_add', target: `${node.id}:${port}/${protocol}:${action}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to add firewall rule' });
  }
});

cockpitRouter.delete('/nodes/:nodeId/cockpit/firewall/rules', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { port, protocol } = req.query;

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/cockpit/firewall/rules?port=${encodeURIComponent(String(port ?? ''))}&protocol=${encodeURIComponent(String(protocol ?? 'tcp'))}`), {
      method: 'DELETE',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'cockpit.firewall_rule_delete', target: `${node.id}:${port}/${protocol}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to delete firewall rule' });
  }
});

// ── 6. COCKPIT-NATIVE SSH TICKET (for non-Leaseweb nodes using stored SSH key) ────

/**
 * POST /api/nodes/:nodeId/cockpit/ssh-ticket
 *
 * Issues a short-lived SSH ticket for the interactive terminal, resolved
 * against the node's stored IP + SSH key reference in the secrets vault.
 * This is the counterpart to the Leaseweb SSH ticket for nodes that were
 * not provisioned through Leaseweb (or any other third-party VPS provider).
 */
cockpitRouter.post('/nodes/:nodeId/cockpit/ssh-ticket', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const sshKeyRef = 'sshKeyRef' in node ? (node as any).sshKeyRef || 'default' : 'default';
    const ticket = issueSshTicket(`node:${node.ip}:${sshKeyRef}`, req.user!.id);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'cockpit.ssh_ticket_issued',
        target: `${node.id}:${node.ip}`,
      },
    });

    res.json({ ticket, expiresInMs: 30_000, ip: node.ip });
  } catch (err: any) {
    logger.error({ err, nodeId: node.id }, 'Failed to issue cockpit SSH ticket');
    res.status(500).json({ error: 'Failed to issue SSH ticket' });
  }
});

