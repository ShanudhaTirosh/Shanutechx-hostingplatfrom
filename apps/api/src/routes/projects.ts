import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireDev, AuthedRequest } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import crypto from 'crypto';
import { provisionProjectBucket } from '../lib/r2Storage';

export const projectsRouter = Router();

/**
 * The Project primitive — isolated auth (ProjectAuthUser), storage bucket,
 * Postgres database, realtime, functions — is the platform's in-house
 * Supabase clone. It is infrastructure the dev (platform owner) uses to
 * build ShanuTechX's own products.
 */
projectsRouter.use(requireAuth, requireDev);

// ── Helper: load a project the caller is allowed to see ─────────────────────
// (Kept for shape/compat with the rest of the file, but with requireDev on
// the whole router above, every caller reaching here already IS dev — this
// is effectively always true now. Left explicit rather than removed, in
// case a future non-dev read-only view is intentionally added back.)

async function loadOwnedProject(req: AuthedRequest, id: string) {
  const proj = await prisma.project.findUnique({ where: { id } });
  if (!proj) return null;
  if (req.user!.role !== 'dev') return null;
  return proj;
}

// ── List projects (dev sees all — dev is the only role that reaches here) ───

projectsRouter.get('/projects', async (_req: AuthedRequest, res) => {
  const projects = await prisma.project.findMany({
    include: { user: { select: { id: true, email: true, displayName: true } }, node: { select: { id: true, label: true, ip: true } } },
    orderBy: { createdAt: 'desc' },
  });
  // Don't expose passwords in list view
  const sanitized = projects.map(({ dbPassword, ...rest }: any) => rest);
  res.json({ projects: sanitized });
});

// ── Create project (dev only) ────────────────────────────────────────────────

const createSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(60),
  nodeId: z.string().min(1),
  orderItemId: z.string().optional(),
});

projectsRouter.post('/projects', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { userId, name, nodeId, orderItemId } = parsed.data;

  // Verify node exists
  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Generate secure DB credentials
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const dbName = `proj_${slug}_${crypto.randomBytes(3).toString('hex')}`;
  const dbUsername = `user_${crypto.randomBytes(4).toString('hex')}`;
  const rawPassword = crypto.randomBytes(16).toString('hex');
  const encryptedPassword = encryptSecret(rawPassword, env.secretsEncryptionKey);

  const project = await prisma.project.create({
    data: {
      userId,
      name,
      nodeId,
      dbName,
      dbUsername,
      dbPassword: encryptedPassword,
      status: 'pending',
    },
    include: {
      user: { select: { id: true, email: true } },
      node: { select: { id: true, label: true, ip: true } },
    },
  });

  // Kick off provisioning on node-agent (fire-and-forget with status update)
  void provisionProject(project.id, node.ip, dbName, dbUsername, rawPassword);

  res.status(201).json({ project });
});

async function provisionProject(
  projectId: string,
  nodeIp: string,
  dbName: string,
  dbUsername: string,
  password: string
) {
  try {
    const { env } = await import('../env');
    const agentUrl = `http://${nodeIp}:${env.nodeAgentPort}/agent/projects`;
    const res = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-secret': env.nodeAgentSecret,
      },
      body: JSON.stringify({ projectId, dbName, dbUsername, password }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`node-agent responded ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { apiPort?: number; containerId?: string };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'running',
        apiPort: data.apiPort ?? null,
        containerId: data.containerId ?? null,
      },
    });
  } catch (err: any) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'failed' },
    });
  }
}

// ── Get single project ───────────────────────────────────────────────────────

projectsRouter.get('/projects/:id', async (req: AuthedRequest, res) => {
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  // Reveal decrypted password only for the project owner (and staff)
  const password = decryptSecret(proj.dbPassword, env.secretsEncryptionKey);

  res.json({
    project: {
      ...proj,
      dbPassword: password,
    },
  });
});

// ── Delete / deprovision project (staff only) ────────────────────────────────

projectsRouter.delete('/projects/:id', async (req: AuthedRequest, res) => {
  const proj = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  // Fire-and-forget deprovision on node-agent
  if (proj.containerId && proj.node) {
    void deprovisionProject(proj.node.ip, proj.id);
  }

  await prisma.project.delete({ where: { id: proj.id } });
  res.json({ ok: true });
});

async function deprovisionProject(nodeIp: string, projectId: string) {
  try {
    const { env } = await import('../env');
    await fetch(`http://${nodeIp}:${env.nodeAgentPort}/agent/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'x-agent-secret': env.nodeAgentSecret },
    });
  } catch (_) {
    // best-effort
  }
}

// ── Object storage (R2 bucket) per project — dev/admin only ─────────────────
// See lib/r2Storage.ts for the honest limitations (shared platform R2
// credentials, not a per-bucket scoped token).

projectsRouter.post('/projects/:id/storage', async (req: AuthedRequest, res) => {
  const proj = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  try {
    const { bucketName, endpoint } = await provisionProjectBucket(proj.id);
    await prisma.project.update({ where: { id: proj.id }, data: { r2BucketName: bucketName } });
    res.status(201).json({ bucketName, endpoint });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ── Execute SQL on the project database ─────────────────────────────────────
// Tunnels an arbitrary SQL statement through the node-agent to the project's
// Postgres container. The node-agent validates it's running in the right DB.

const sqlSchema = z.object({
  sql: z.string().min(1).max(50_000),
});

projectsRouter.post('/projects/:id/sql', async (req: AuthedRequest, res) => {
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  if (proj.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const parsed = sqlSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const node = await prisma.node.findUnique({ where: { id: proj.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const agentRes = await fetch(
      `http://${node.ip}:${env.nodeAgentPort}/agent/projects/${proj.id}/sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-secret': env.nodeAgentSecret,
        },
        body: JSON.stringify({ sql: parsed.data.sql, dbName: proj.dbName }),
      }
    );

    const agentData = (await agentRes.json()) as any;
    if (!agentRes.ok) {
      return res.status(400).json({ error: agentData.error ?? 'SQL execution failed' });
    }

    res.json(agentData); // { rows, fields, rowCount }
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'SQL execution failed' });
  }
});

// ── List tables in the project database ─────────────────────────────────────

projectsRouter.get('/projects/:id/tables', async (req: AuthedRequest, res) => {
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  if (proj.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const node = await prisma.node.findUnique({ where: { id: proj.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const agentRes = await fetch(
      `http://${node.ip}:${env.nodeAgentPort}/agent/projects/${proj.id}/tables`,
      { headers: { 'x-agent-secret': env.nodeAgentSecret } }
    );
    const data = (await agentRes.json()) as any;
    if (!agentRes.ok) return res.status(400).json({ error: data.error ?? 'Failed to list tables' });
    res.json(data); // { tables: [{ name, columns: [{name, type}] }] }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRUD proxy endpoints ─────────────────────────────────────────────────────
// GET    /projects/:id/tables/:table/rows
// POST   /projects/:id/tables/:table/rows
// PATCH  /projects/:id/tables/:table/rows/:pk
// DELETE /projects/:id/tables/:table/rows/:pk

async function proxyToAgent(
  req: AuthedRequest,
  res: any,
  method: string,
  agentPath: string,
  body?: Record<string, unknown>
) {
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  if (proj.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const node = await prisma.node.findUnique({ where: { id: proj.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const url = `http://${node.ip}:${env.nodeAgentPort}${agentPath}`;
    const headers: Record<string, string> = { 'x-agent-secret': env.nodeAgentSecret };
    const payload = body ? { ...body, dbName: proj.dbName } : undefined;
    if (payload) headers['Content-Type'] = 'application/json';

    const agentRes = await fetch(url, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await agentRes.json().catch(() => ({}));
    res.status(agentRes.ok ? 200 : agentRes.status || 500).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to communicate with node agent' });
  }
}

projectsRouter.get('/projects/:id/tables/:table/rows', async (req: AuthedRequest, res) => {
  const { page = '1', limit = '50' } = req.query as Record<string, string>;
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const node = await prisma.node.findUnique({ where: { id: proj.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const url = `http://${node.ip}:${env.nodeAgentPort}/agent/projects/${proj.id}/tables/${req.params.table}/rows?page=${page}&limit=${limit}&dbName=${proj.dbName}`;
    const agentRes = await fetch(url, { headers: { 'x-agent-secret': env.nodeAgentSecret } });
    const data = await agentRes.json().catch(() => ({}));
    res.status(agentRes.ok ? 200 : agentRes.status || 500).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to communicate with node agent' });
  }
});

projectsRouter.post('/projects/:id/tables/:table/rows', async (req: AuthedRequest, res) => {
  // Verify ownership before proxying
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  
  await proxyToAgent(
    req, res, 'POST',
    `/agent/projects/${req.params.id}/tables/${req.params.table}/rows`,
    req.body
  );
});

projectsRouter.patch('/projects/:id/tables/:table/rows/:pk', async (req: AuthedRequest, res) => {
  // Verify ownership before proxying
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  
  await proxyToAgent(
    req, res, 'PATCH',
    `/agent/projects/${req.params.id}/tables/${req.params.table}/rows/${req.params.pk}`,
    req.body
  );
});

projectsRouter.delete('/projects/:id/tables/:table/rows/:pk', async (req: AuthedRequest, res) => {
  // Verify ownership before proxying
  const proj = await loadOwnedProject(req, req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  
  await proxyToAgent(
    req, res, 'DELETE',
    `/agent/projects/${req.params.id}/tables/${req.params.table}/rows/${req.params.pk}`,
    undefined
  );
});
