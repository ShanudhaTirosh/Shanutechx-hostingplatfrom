import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { env } from '../env';
import { logger } from '../lib/logger';
import { issueSshTicket } from '../lib/sshTerminalGateway';

export const nodeEngineRouter = Router();

nodeEngineRouter.use(requireAuth);

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
    return null;
  }

  // 2. Try finding a customer VPS provision
  const provision = await prisma.vpsProvision.findUnique({ where: { id: nodeId } });
  if (provision) {
    const allowed = await canAccessResource(provision.userId, req);
    if (!allowed) return null;

    let ip: string | null = provision.ip || null;
    if (!ip && provision.panelUrl) {
      try {
        const url = new URL(provision.panelUrl);
        ip = url.hostname;
      } catch (err) {
        logger.warn({ err, provisionId: provision.id, panelUrl: provision.panelUrl }, 'Invalid panelUrl on VPS provision');
      }
    }

    if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
      return null;
    }

    return {
      id: provision.id,
      label: `vps-${provision.externalId || provision.id.slice(0, 8)}`,
      ip,
      monthlyBandwidthGb: 30000,
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

// ── 1. SYSTEM MONITORING & TELEMETRY ──────────────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/monitoring', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const limitGb = (node as any).monthlyBandwidthGb || 30000;

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/monitoring?monthlyLimitGb=${limitGb}`), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    logger.error({ err, nodeId: node.id }, 'Failed to fetch engine monitoring');
    res.status(502).json({ error: err.message || 'Failed to fetch node monitoring info' });
  }
});

// ── 2. OS PACKAGE INSTALLATION & SYSTEM UPGRADES ──────────────────────────

nodeEngineRouter.post('/nodes/:nodeId/engine/packages/install', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { packageName } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/packages/install'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ packageName }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.package_install', target: `${node.id}:${packageName}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Package installation failed' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/packages/upgrade', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/packages/upgrade'), {
      method: 'POST',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.system_upgrade', target: node.id },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'System upgrade failed' });
  }
});

// ── 3. LISTENING PORTS DETECTOR ───────────────────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/ports', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/ports'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to detect open ports' });
  }
});

// ── 4. SYSTEMD SERVICE MANAGEMENT ──────────────────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/services', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/services'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list services' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/services/action', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { action, serviceName } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/services/action'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ action, serviceName }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'nodeEngine.service_action',
          target: `${node.id}:${serviceName}:${action}`,
        },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Service action failed' });
  }
});

nodeEngineRouter.get('/nodes/:nodeId/engine/services/logs', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { serviceName, lines } = req.query;
  const path = `/agent/engine/services/logs?serviceName=${encodeURIComponent(String(serviceName ?? ''))}&lines=${encodeURIComponent(String(lines ?? 100))}`;

  try {
    const r = await fetch(agentUrl(node.ip, path), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch service logs' });
  }
});

// ── 5. LINUX USER MANAGEMENT ───────────────────────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/users', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/users'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list Linux users' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/users', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { username, password } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/users'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.user_create', target: `${node.id}:${username}` },
      });
    }

    res.status(r.ok ? 201 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to create Linux user' });
  }
});

nodeEngineRouter.delete('/nodes/:nodeId/engine/users/:username', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const removeHome = req.query.removeHome ?? 'true';

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/users/${encodeURIComponent(req.params.username)}?removeHome=${removeHome}`), {
      method: 'DELETE',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.user_delete', target: `${node.id}:${req.params.username}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to delete Linux user' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/users/:username/password', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { password } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/users/${encodeURIComponent(req.params.username)}/password`), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.user_password_reset', target: `${node.id}:${req.params.username}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to reset password' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/users/:username/groups', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { group, action } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/users/${encodeURIComponent(req.params.username)}/groups`), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ group, action }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.user_groups_modify', target: `${node.id}:${req.params.username}:${group}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to modify user groups' });
  }
});

// ── 6. DOCKER CONTAINER & NETWORK ORCHESTRATION ────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/docker/containers', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/containers'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list containers' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/docker/containers', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/containers'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.container_create', target: `${node.id}:${req.body.name}` },
      });
    }

    res.status(r.ok ? 201 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to create container' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/docker/containers/:containerId/action', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { action } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/docker/containers/${encodeURIComponent(req.params.containerId)}/action`), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ action }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.container_action', target: `${node.id}:${req.params.containerId}:${action}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to perform container action' });
  }
});

nodeEngineRouter.get('/nodes/:nodeId/engine/docker/containers/:containerId/logs', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const tail = req.query.tail ? String(req.query.tail) : '200';

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/docker/containers/${encodeURIComponent(req.params.containerId)}/logs?tail=${tail}`), {
      headers: agentHeaders(),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch container logs' });
  }
});

nodeEngineRouter.get('/nodes/:nodeId/engine/docker/networks', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/networks'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list Docker networks' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/docker/networks', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { name, driver } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/networks'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ name, driver }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.network_create', target: `${node.id}:${name}` },
      });
    }

    res.status(r.ok ? 201 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to create Docker network' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/docker/compose', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { yamlContent, projectName } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/compose'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ yamlContent, projectName }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.compose_deploy', target: `${node.id}:${projectName}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to deploy docker compose stack' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/docker/prune', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/docker/prune'), {
      method: 'POST',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.docker_prune', target: node.id },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to prune Docker resources' });
  }
});

// ── 7. UFW FIREWALL CONFIGURATION ──────────────────────────────────────────

nodeEngineRouter.get('/nodes/:nodeId/engine/firewall', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/firewall'), { headers: agentHeaders() });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch UFW status' });
  }
});

nodeEngineRouter.post('/nodes/:nodeId/engine/firewall/rules', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { port, protocol, action } = req.body || {};

  try {
    const r = await fetch(agentUrl(node.ip, '/agent/engine/firewall/rules'), {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({ port, protocol, action }),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.firewall_rule_add', target: `${node.id}:${port}/${protocol}:${action}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to add firewall rule' });
  }
});

nodeEngineRouter.delete('/nodes/:nodeId/engine/firewall/rules', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  const { port, protocol } = req.query;

  try {
    const r = await fetch(agentUrl(node.ip, `/agent/engine/firewall/rules?port=${encodeURIComponent(String(port ?? ''))}&protocol=${encodeURIComponent(String(protocol ?? 'tcp'))}`), {
      method: 'DELETE',
      headers: agentHeaders(),
    });
    const data = await r.json();

    if (r.ok) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'nodeEngine.firewall_rule_delete', target: `${node.id}:${port}/${protocol}` },
      });
    }

    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to delete firewall rule' });
  }
});

// ── 8. INTERACTIVE SSH TICKET (for non-Leaseweb nodes using stored SSH key) ──

nodeEngineRouter.post('/nodes/:nodeId/engine/ssh-ticket', async (req: AuthedRequest, res) => {
  const node = await resolveNodeAccess(req, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node or VPS not found' });

  try {
    const sshKeyRef = 'sshKeyRef' in node ? (node as any).sshKeyRef || 'default' : 'default';
    const ticket = await issueSshTicket(`node:${node.ip}:${sshKeyRef}`, req.user!.id);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'nodeEngine.ssh_ticket_issued',
        target: `${node.id}:${node.ip}`,
      },
    });

    res.json({ ticket, expiresInMs: 30_000, ip: node.ip });
  } catch (err: any) {
    logger.error({ err, nodeId: node.id }, 'Failed to issue SSH ticket');
    res.status(500).json({ error: 'Failed to issue SSH ticket' });
  }
});
