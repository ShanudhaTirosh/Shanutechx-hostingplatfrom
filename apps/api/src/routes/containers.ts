import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { listNodeContainers, containerAction, getContainerLogs } from '../lib/nodeAgentClient';

/**
 * Dev/admin-only: see and manage every container on every registered node —
 * not scoped to a single deployment, unlike routes/deployments.ts. Reuses
 * the Node Agent's /agent/containers endpoints (services/node-agent/src/
 * docker.js's listContainers/stopContainer/startContainer/restartContainer).
 *
 * Stop here is intentionally non-destructive (docker stop, not remove) —
 * this page can list infra containers (Traefik, managed databases, etc.),
 * not just customer deployments, so a "Stop" click must never delete
 * something that would otherwise need a full redeploy to bring back.
 */
export const containersRouter = Router();

containersRouter.use(requireAuth, requireAdminOrDev);

containersRouter.get('/nodes/:nodeId/containers', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    const containers = await listNodeContainers(node);
    res.json({ containers });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

const actionSchema = z.object({ action: z.enum(['start', 'stop', 'restart']) });

containersRouter.post('/nodes/:nodeId/containers/:containerId/action', async (req: AuthedRequest, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    await containerAction(node, req.params.containerId, parsed.data.action);
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: `container.${parsed.data.action}`, target: req.params.containerId },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

containersRouter.get('/nodes/:nodeId/containers/:containerId/logs', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    const logs = await getContainerLogs(node, req.params.containerId, req.query.tail ? Number(req.query.tail) : 200);
    res.json({ logs });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /nodes/:nodeId/containers/:containerId/exec-ticket
 * Issues a ticket token for live WebSocket terminal docker exec session.
 */
containersRouter.post('/nodes/:nodeId/containers/:containerId/exec-ticket', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const { issueContainerExecTicket } = await import('../lib/containerExecGateway');
  const ticketInfo = issueContainerExecTicket(node.id, req.params.containerId, req.user!.id);
  res.json(ticketInfo);
});

/**
 * GET /nodes/:nodeId/containers/:containerId/stats
 * Fetches real-time memory, CPU, and network stats for a container via node-agent.
 */
containersRouter.get('/nodes/:nodeId/containers/:containerId/stats', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    const { getResourceUsage } = await import('../lib/nodeAgentClient');
    const metrics = await getResourceUsage(node, req.params.containerId);
    res.json({ containerId: req.params.containerId, ...metrics });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch container metrics from node' });
  }
});

/**
 * DELETE /nodes/:nodeId/containers/:containerId
 * Removes/destroys a container from node.
 */
containersRouter.delete('/nodes/:nodeId/containers/:containerId', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    await containerAction(node, req.params.containerId, 'stop');
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'container.remove', target: req.params.containerId },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

