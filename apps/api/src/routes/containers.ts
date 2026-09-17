import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { listNodeContainers, containerAction, getContainerLogs, removeNodeContainer } from '../lib/nodeAgentClient';

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
  const ticketInfo = await issueContainerExecTicket(node.id, req.params.containerId, req.user!.id);
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
    await removeNodeContainer(node, req.params.containerId);
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'container.remove', target: req.params.containerId },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ── Container Extended Management ──────────────────────────────────────────

containersRouter.post('/nodes/:nodeId/containers/:containerId/pause', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pauseContainer } = await import('../lib/nodeAgentClient');
    await pauseContainer(node, req.params.containerId);
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/containers/:containerId/unpause', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { unpauseContainer } = await import('../lib/nodeAgentClient');
    await unpauseContainer(node, req.params.containerId);
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.put('/nodes/:nodeId/containers/:containerId/rename', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { renameContainer } = await import('../lib/nodeAgentClient');
    await renameContainer(node, req.params.containerId, req.body.name);
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/containers/:containerId/top', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { containerTop } = await import('../lib/nodeAgentClient');
    const result = await containerTop(node, req.params.containerId);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/containers/:containerId/changes', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { containerChanges } = await import('../lib/nodeAgentClient');
    const result = await containerChanges(node, req.params.containerId);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

// ── Image Management Routes ────────────────────────────────────────────────

containersRouter.get('/nodes/:nodeId/images', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { listNodeImages } = await import('../lib/nodeAgentClient');
    const images = await listNodeImages(node);
    res.json({ images });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/images/:imageId', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { inspectNodeImage } = await import('../lib/nodeAgentClient');
    const info = await inspectNodeImage(node, req.params.imageId);
    res.json(info);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/images/pull', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pullNodeImage } = await import('../lib/nodeAgentClient');
    const result = await pullNodeImage(node, req.body.image, req.body.tag);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.delete('/nodes/:nodeId/images/:imageId', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { removeNodeImage } = await import('../lib/nodeAgentClient');
    await removeNodeImage(node, req.params.imageId, req.query.force === 'true');
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/images/prune', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pruneNodeImages } = await import('../lib/nodeAgentClient');
    const result = await pruneNodeImages(node);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

// ── Volume Management Routes ───────────────────────────────────────────────

containersRouter.get('/nodes/:nodeId/volumes', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { listNodeVolumes } = await import('../lib/nodeAgentClient');
    const volumes = await listNodeVolumes(node);
    res.json({ volumes });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/volumes/:name', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { inspectNodeVolume } = await import('../lib/nodeAgentClient');
    const info = await inspectNodeVolume(node, req.params.name);
    res.json(info);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/volumes', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { createNodeVolume } = await import('../lib/nodeAgentClient');
    const result = await createNodeVolume(node, req.body.name, req.body.driver, req.body.labels);
    res.status(201).json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.delete('/nodes/:nodeId/volumes/:name', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { removeNodeVolume } = await import('../lib/nodeAgentClient');
    await removeNodeVolume(node, req.params.name);
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/volumes/prune', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pruneNodeVolumes } = await import('../lib/nodeAgentClient');
    const result = await pruneNodeVolumes(node);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

// ── Network Management Routes ──────────────────────────────────────────────

containersRouter.get('/nodes/:nodeId/networks', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { listNodeNetworks } = await import('../lib/nodeAgentClient');
    const networks = await listNodeNetworks(node);
    res.json({ networks });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/networks/:networkId', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { inspectNodeNetwork } = await import('../lib/nodeAgentClient');
    const info = await inspectNodeNetwork(node, req.params.networkId);
    res.json(info);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/networks', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { createNodeNetwork } = await import('../lib/nodeAgentClient');
    const result = await createNodeNetwork(node, req.body.name, req.body.driver, req.body.options);
    res.status(201).json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.delete('/nodes/:nodeId/networks/:networkId', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { removeNodeNetwork } = await import('../lib/nodeAgentClient');
    await removeNodeNetwork(node, req.params.networkId);
    res.json({ ok: true });
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/networks/prune', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pruneNodeNetworks } = await import('../lib/nodeAgentClient');
    const result = await pruneNodeNetworks(node);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

// ── Docker System Routes ───────────────────────────────────────────────────

containersRouter.get('/nodes/:nodeId/docker/system/info', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { getNodeDockerInfo } = await import('../lib/nodeAgentClient');
    const info = await getNodeDockerInfo(node);
    res.json(info);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.get('/nodes/:nodeId/docker/system/df', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { getNodeDockerDf } = await import('../lib/nodeAgentClient');
    const df = await getNodeDockerDf(node);
    res.json(df);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

containersRouter.post('/nodes/:nodeId/docker/system/prune', async (req: AuthedRequest, res) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  try {
    const { pruneNodeImages } = await import('../lib/nodeAgentClient');
    const result = await pruneNodeImages(node);
    res.json(result);
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});



