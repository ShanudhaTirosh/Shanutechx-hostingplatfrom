import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { logger } from '../lib/logger';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import {
  DeploymentPortRow,
  NodeExposureRow,
  NodeRow,
  PortError,
  buildOverview,
  effectiveHostPort,
  modeFromStored,
  reservedPorts,
  validateExposureChange,
} from '../lib/portExposure';

/**
 * Exposed-port overview and safe edit/close of a deployment's exposure.
 *
 *   GET /ports/overview                dev only: every node, its deployments' modes/ports, node port exposures, and problems
 *   GET /deployments/:id/exposure      current exposure of one deployment (+ problems)
 *   PUT /deployments/:id/exposure      change the mode / published port (dev only, validated, audited)
 *
 * A change is stored, NOT applied: the container keeps its current routing until it is redeployed, and the response says
 * so (`requiresRedeploy`). See docs/PORT_EXPOSURE.md.
 */
export const portsRouter = Router();
portsRouter.use(requireAuth);

const extraReserved = (process.env.EXPOSURE_RESERVED_PORTS ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535);
const reserved = reservedPorts(env.nodeAgentPort, extraReserved);

const portSelect = { id: true, userId: true, nodeId: true, subdomain: true, status: true, exposureMode: true, internalPort: true, publishedPort: true, frameworkPreset: true, parentDeploymentId: true } as const;

function toRow(d: any): DeploymentPortRow {
  return {
    id: d.id, userId: d.userId, nodeId: d.nodeId, subdomain: d.subdomain ?? null, status: d.status, exposureMode: d.exposureMode ?? null,
    internalPort: d.internalPort ?? null, publishedPort: d.publishedPort ?? null, frameworkPreset: d.frameworkPreset ?? null, isPreview: Boolean(d.parentDeploymentId),
  };
}

const isDev = (req: AuthedRequest) => req.user?.role === 'dev';

function fail(res: Response, err: unknown, ctx: Record<string, unknown>) {
  if (err instanceof PortError) return res.status(err.status).json({ error: err.message, code: err.code });
  logger.error({ err, ...ctx }, 'Unexpected error handling a port exposure request');
  return res.status(500).json({ error: 'Something went wrong while handling the port request.', code: 'internal' });
}

portsRouter.get('/ports/overview', async (req: AuthedRequest, res) => {
  try {
    if (!isDev(req)) return res.status(403).json({ error: 'Only dev superusers can view the ports overview.', code: 'forbidden' });
    const [nodes, deployments, exposures] = await Promise.all([
      prisma.node.findMany({ select: { id: true, label: true, ip: true, isActive: true }, orderBy: { label: 'asc' } }),
      prisma.deployment.findMany({ where: { status: { not: 'deleted' } }, select: portSelect }),
      prisma.nodePortExposure.findMany({ orderBy: { port: 'asc' } }),
    ]);
    const overview = buildOverview({
      nodes: nodes as NodeRow[],
      deployments: deployments.map(toRow),
      exposures: exposures as unknown as NodeExposureRow[],
      rootDomain: env.rootDomain,
      reserved,
    });
    res.json({ ...overview, reservedPorts: [...reserved].sort((a, b) => a - b) });
  } catch (err) {
    fail(res, err, { route: 'overview' });
  }
});

async function loadDeployment(req: AuthedRequest, res: Response, action: 'read' | 'write') {
  const d = await prisma.deployment.findUnique({ where: { id: req.params.id }, select: portSelect });
  if (!d || d.status === 'deleted' || !(await canAccessResource(d.userId, req, 'deployment', d.id, action))) {
    res.status(404).json({ error: 'Deployment not found', code: 'not_found' });
    return null;
  }
  return d;
}

async function nodeContext(nodeId: string, exceptId: string) {
  const [siblings, exposures, node] = await Promise.all([
    prisma.deployment.findMany({ where: { nodeId, id: { not: exceptId }, status: { not: 'deleted' } }, select: portSelect }),
    prisma.nodePortExposure.findMany({ where: { nodeId } }),
    prisma.node.findUnique({ where: { id: nodeId }, select: { id: true, label: true, ip: true, isActive: true } }),
  ]);
  return { siblings: siblings.map(toRow), exposures: exposures as unknown as NodeExposureRow[], node: node as NodeRow | null };
}

portsRouter.get('/deployments/:id/exposure', async (req: AuthedRequest, res) => {
  try {
    const d = await loadDeployment(req, res, 'read');
    if (!d) return;
    const row = toRow(d);
    const ctx = await nodeContext(d.nodeId, d.id);
    const overview = buildOverview({ nodes: ctx.node ? [ctx.node] : [], deployments: [row, ...ctx.siblings], exposures: ctx.exposures, rootDomain: env.rootDomain, reserved });
    const me = overview.nodes[0]?.deployments.find((x) => x.id === d.id);
    res.json({
      exposure: {
        mode: modeFromStored(row.exposureMode),
        storedMode: row.exposureMode,
        publishedPort: row.publishedPort,
        hostPort: effectiveHostPort(row),
        internalPort: row.internalPort,
        url: me?.url ?? null,
        status: d.status,
        // A running deployment needs the typed confirmation on PUT; this is the text to type.
        requiresConfirm: d.status === 'running',
        confirmName: d.subdomain ?? d.id,
        issues: me?.issues ?? [],
      },
      canEdit: isDev(req),
      minPublishedPort: 1024,
    });
  } catch (err) {
    fail(res, err, { route: 'get-exposure', deploymentId: req.params.id });
  }
});

const putBody = z.object({
  mode: z.enum(['proxied', 'direct_port', 'internal']),
  publishedPort: z.number().int().nullable().optional(),
  /** Required when the deployment is running: its subdomain (or id). Server-side guard for a destructive change. */
  confirm: z.string().optional(),
});

portsRouter.put('/deployments/:id/exposure', async (req: AuthedRequest, res) => {
  try {
    if (!isDev(req)) {
      return res.status(403).json({ error: 'Only dev superusers can change how a deployment is exposed.', code: 'forbidden' });
    }
    const d = await loadDeployment(req, res, 'write');
    if (!d) return;
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'mode must be proxied, direct_port or internal; publishedPort must be a whole number.', code: 'invalid' });
    if (d.status === 'building') return res.status(409).json({ error: 'This deployment is building right now. Try again when it finishes.', code: 'busy' });

    const row = toRow(d);
    const ctx = await nodeContext(d.nodeId, d.id);
    const next = validateExposureChange(parsed.data, { deployment: row, siblings: ctx.siblings, nodeExposures: ctx.exposures, reserved });

    const changed = next.exposureMode !== modeStoredNormalized(row.exposureMode) || next.publishedPort !== (row.publishedPort ?? null);
    if (!changed) return res.json({ changed: false, requiresRedeploy: false, exposure: { mode: parsed.data.mode, publishedPort: next.publishedPort } });

    if (d.status === 'running') {
      const expected = d.subdomain ?? d.id;
      if ((parsed.data.confirm ?? '').trim() !== expected) {
        return res.status(400).json({ error: `This deployment is running. Type "${expected}" to confirm the change.`, code: 'confirmation_mismatch' });
      }
    }

    await prisma.deployment.update({ where: { id: d.id }, data: { exposureMode: next.exposureMode, publishedPort: next.publishedPort } });
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'deployment.exposure.updated',
        target: `${d.id}: ${row.exposureMode ?? 'unset'}/${row.publishedPort ?? '-'} -> ${next.exposureMode}/${next.publishedPort ?? '-'}`,
      },
    });
    logger.info({ deploymentId: d.id, from: row.exposureMode, to: next.exposureMode, port: next.publishedPort }, 'Deployment exposure updated');

    res.json({
      changed: true,
      // The running container keeps its old routing until it is redeployed.
      requiresRedeploy: Boolean(d.status === 'running' || d.status === 'stopped'),
      exposure: { mode: parsed.data.mode, storedMode: next.exposureMode, publishedPort: next.publishedPort, hostPort: effectiveHostPort({ ...row, ...next }) },
    });
  } catch (err) {
    fail(res, err, { route: 'put-exposure', deploymentId: req.params.id });
  }
});

/** Old rows may hold ssl_direct / raw_tcp; a no-op change must compare against the canonical stored value. */
function modeStoredNormalized(stored: string | null): string {
  const m = modeFromStored(stored);
  return m === 'direct_port' ? 'no_ssl' : m === 'internal' ? 'internal_only' : 'ssl_with_proxy';
}
