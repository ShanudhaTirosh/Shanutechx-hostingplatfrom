import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import { env } from '../env';
import { provisionProjectBucket } from '../lib/r2Storage';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

/**
 * Helper: Check if caller can access a project
 * Allowed if:
 * 1. Dev user (role === 'dev')
 * 2. Owner of project (project.userId === req.user.id)
 * 3. Member of project in ProjectMember table
 * 4. Assigned Admin for customer owner
 */
async function canAccessProject(req: AuthedRequest, projectId: string): Promise<{ project: any; role: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      node: { select: { id: true, label: true, ip: true } },
      members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
      managedDatabases: true,
    },
  });

  if (!project) return null;

  // Dev user has superuser access
  if (req.user!.role === 'dev') {
    return { project, role: 'owner' };
  }

  // Owner of project
  if (project.userId === req.user!.id) {
    return { project, role: 'owner' };
  }

  // Check project membership
  const member = project.members.find((m: any) => m.userId === req.user!.id);
  if (member) {
    return { project, role: member.role };
  }

  // Assigned Admin check
  if (req.user!.role === 'admin' && (await canAccessResource(project.userId, req))) {
    return { project, role: 'admin' };
  }

  return null;
}

// ── 1. List Projects ────────────────────────────────────────────────────────
projectsRouter.get('/projects', async (req: AuthedRequest, res) => {
  try {
    const isDev = req.user!.role === 'dev';
    const isAdmin = req.user!.role === 'admin';
    const userId = req.user!.id;

    let whereCondition: any = {};

    if (isDev) {
      // Dev sees all
      whereCondition = {};
    } else if (isAdmin) {
      // Admin sees owned, assigned customers', or membership projects
      const assignedCustomers = await prisma.user.findMany({
        where: { assignedAdminId: userId },
        select: { id: true },
      });
      const customerIds = assignedCustomers.map((c) => c.id);
      whereCondition = {
        OR: [
          { userId },
          { userId: { in: customerIds } },
          { members: { some: { userId } } },
        ],
      };
    } else {
      // Customer sees owned or member projects
      whereCondition = {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      };
    }

    const { search, isArchived } = req.query as { search?: string; isArchived?: string };
    if (isArchived !== undefined) {
      whereCondition.isArchived = isArchived === 'true';
    }

    if (search) {
      whereCondition.name = { contains: search, mode: 'insensitive' };
    }

    const projects = await prisma.project.findMany({
      where: whereCondition,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        node: { select: { id: true, label: true, ip: true } },
        members: { select: { id: true, userId: true, role: true } },
        _count: {
          select: {
            managedDatabases: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = projects.map(({ dbPassword, ...rest }: any) => rest);
    res.json({ projects: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list projects' });
  }
});

// ── 2. Create Project ───────────────────────────────────────────────────────
const createProjectSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(255).optional(),
  region: z.string().optional(),
  nodeId: z.string().optional(),
  targetUserId: z.string().optional(),
});

projectsRouter.post('/projects', async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, description, region, nodeId, targetUserId } = parsed.data;

  // Determine owner user
  let ownerUserId = req.user!.id;
  if (targetUserId && (req.user!.role === 'admin' || req.user!.role === 'dev')) {
    if (req.user!.role === 'admin' && !(await canAccessResource(targetUserId, req))) {
      return res.status(403).json({ error: 'Unauthorized to create project for target user' });
    }
    ownerUserId = targetUserId;
  }

  // Select node if not specified
  let selectedNodeId = nodeId;
  if (!selectedNodeId) {
    try {
      const selectedNode = await selectNodeForDeployment({ requiredTag: 'node-hosting', isAdminDeployment: true });
      selectedNodeId = selectedNode.id;
    } catch (err: any) {
      if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
      return res.status(500).json({ error: 'Failed to select node for project' });
    }
  }

  const node = await prisma.node.findUnique({ where: { id: selectedNodeId } });
  if (!node) return res.status(404).json({ error: 'Target node not found' });

  // Generate DB credentials for default project database container
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const dbName = `proj_${slug}_${crypto.randomBytes(3).toString('hex')}`;
  const dbUsername = `user_${crypto.randomBytes(4).toString('hex')}`;
  const rawPassword = crypto.randomBytes(16).toString('hex');
  const encryptedPassword = encryptSecret(rawPassword, env.secretsEncryptionKey);

  try {
    const project = await prisma.project.create({
      data: {
        userId: ownerUserId,
        name,
        description: description || null,
        region: region || 'ap-southeast-1',
        nodeId: selectedNodeId,
        dbName,
        dbUsername,
        dbPassword: encryptedPassword,
        status: 'pending',
        members: {
          create: {
            userId: ownerUserId,
            role: 'owner',
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        node: { select: { id: true, label: true, ip: true } },
        members: true,
      },
    });

    // Fire provisioning on node-agent
    void provisionProject(project.id, node.ip, dbName, dbUsername, rawPassword);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'project.create',
        target: project.id,
      },
    }).catch(() => {});

    const { dbPassword, ...sanitized } = project;
    res.status(201).json({ project: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create project' });
  }
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

// ── 3. Get Project Details ──────────────────────────────────────────────────
projectsRouter.get('/projects/:id', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found or access denied' });

  const { project, role } = access;
  const password = decryptSecret(project.dbPassword, env.secretsEncryptionKey);

  // Compute resource usage aggregates across project's databases
  const databases = await prisma.managedDatabase.findMany({
    where: { projectId: project.id },
    include: {
      node: { select: { id: true, label: true, ip: true } },
      dbUsers: { select: { id: true, username: true, role: true, isDisabled: true } },
    },
  });

  const aggregateMetrics = {
    totalDatabases: databases.length,
    activeDatabases: databases.filter((d) => d.status === 'running').length,
    totalCpuCores: databases.reduce((acc, d) => acc + (d.cpuLimit || 1), 0),
    totalRamMb: databases.reduce((acc, d) => acc + (d.memoryLimitMb || 512), 0),
    totalStorageGb: databases.reduce((acc, d) => acc + (d.storageLimitGb || 10), 0),
  };

  res.json({
    project: {
      ...project,
      dbPassword: password,
      callerRole: role,
      databases: databases.map(({ credentialRef, ...rest }: any) => rest),
      aggregateMetrics,
    },
  });
});

// ── 4. Update Project ───────────────────────────────────────────────────────
const updateProjectSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(255).optional(),
  region: z.string().optional(),
  isArchived: z.boolean().optional(),
});

projectsRouter.patch('/projects/:id', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  if (access.role !== 'owner' && access.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only project owners and admins can update settings' });
  }

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        node: { select: { id: true, label: true, ip: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'project.update',
        target: req.params.id,
      },
    }).catch(() => {});

    const { dbPassword, ...sanitized } = updated;
    res.json({ project: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update project' });
  }
});

// ── 5. Delete / Archive Project ──────────────────────────────────────────────
projectsRouter.delete('/projects/:id', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  if (access.role !== 'owner' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only the project owner can delete the project' });
  }

  const { project } = access;

  try {
    // Fire-and-forget deprovision on node-agent if container exists
    if (project.containerId && project.node) {
      void deprovisionProject(project.node.ip, project.id);
    }

    await prisma.project.delete({ where: { id: project.id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'project.delete',
        target: project.id,
      },
    }).catch(() => {});

    res.json({ ok: true, deletedId: project.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete project' });
  }
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

// ── 6. Project Members Management ───────────────────────────────────────────
projectsRouter.get('/projects/:id/members', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.id },
    include: { user: { select: { id: true, email: true, displayName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ members });
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'developer', 'read_only']).default('developer'),
});

projectsRouter.post('/projects/:id/members', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  if (access.role !== 'owner' && access.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only owners and admins can invite project members' });
  }

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const targetUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!targetUser) return res.status(404).json({ error: 'User with this email not found' });

  try {
    const member = await prisma.projectMember.create({
      data: {
        projectId: req.params.id,
        userId: targetUser.id,
        role: parsed.data.role,
      },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    res.status(201).json({ member });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }
    res.status(500).json({ error: err.message || 'Failed to add project member' });
  }
});

projectsRouter.delete('/projects/:id/members/:memberUserId', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  if (access.role !== 'owner' && access.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Unauthorized to remove members' });
  }

  try {
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId: req.params.memberUserId,
        },
      },
    });

    res.json({ ok: true, removedUserId: req.params.memberUserId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove project member' });
  }
});

// ── 7. Object Storage Provisioning (R2) ─────────────────────────────────────
projectsRouter.post('/projects/:id/storage', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  try {
    const { bucketName, endpoint } = await provisionProjectBucket(access.project.id);
    await prisma.project.update({ where: { id: access.project.id }, data: { r2BucketName: bucketName } });
    res.status(201).json({ bucketName, endpoint });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ── 8. Execute SQL on Project Default DB Container ──────────────────────────
const sqlSchema = z.object({
  sql: z.string().min(1).max(50_000),
});

projectsRouter.post('/projects/:id/sql', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const { project, role } = access;
  if (role === 'read_only' && /^\s*(DROP|ALTER|DELETE|UPDATE|INSERT|CREATE|TRUNCATE)\b/i.test(req.body.sql)) {
    return res.status(403).json({ error: 'Read-only members cannot execute data definition or modification statements' });
  }

  if (project.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const parsed = sqlSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const node = await prisma.node.findUnique({ where: { id: project.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const agentRes = await fetch(
      `http://${node.ip}:${env.nodeAgentPort}/agent/projects/${project.id}/sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-secret': env.nodeAgentSecret,
        },
        body: JSON.stringify({ sql: parsed.data.sql, dbName: project.dbName }),
      }
    );

    const agentData = (await agentRes.json()) as any;
    if (!agentRes.ok) {
      return res.status(400).json({ error: agentData.error ?? 'SQL execution failed' });
    }

    res.json(agentData);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'SQL execution failed' });
  }
});

// ── 9. List Tables ──────────────────────────────────────────────────────────
projectsRouter.get('/projects/:id/tables', async (req: AuthedRequest, res) => {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const { project } = access;
  if (project.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const node = await prisma.node.findUnique({ where: { id: project.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const agentRes = await fetch(
      `http://${node.ip}:${env.nodeAgentPort}/agent/projects/${project.id}/tables`,
      { headers: { 'x-agent-secret': env.nodeAgentSecret } }
    );
    const data = (await agentRes.json()) as any;
    if (!agentRes.ok) return res.status(400).json({ error: data.error ?? 'Failed to list tables' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 10. Table Row CRUD Proxies ──────────────────────────────────────────────
async function proxyToAgent(
  req: AuthedRequest,
  res: any,
  method: string,
  agentPath: string,
  body?: Record<string, unknown>
) {
  const access = await canAccessProject(req, req.params.id);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const { project, role } = access;
  if (role === 'read_only' && method !== 'GET') {
    return res.status(403).json({ error: 'Read-only member cannot modify table rows' });
  }

  if (project.status !== 'running') return res.status(400).json({ error: 'Project is not running' });

  const node = await prisma.node.findUnique({ where: { id: project.nodeId } });
  if (!node) return res.status(500).json({ error: 'Node not found' });

  try {
    const { env } = await import('../env');
    const url = `http://${node.ip}:${env.nodeAgentPort}${agentPath}`;
    const headers: Record<string, string> = { 'x-agent-secret': env.nodeAgentSecret };
    const payload = body ? { ...body, dbName: project.dbName } : undefined;
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
  const table = encodeURIComponent(req.params.table);
  await proxyToAgent(
    req, res, 'GET',
    `/agent/projects/${req.params.id}/tables/${table}/rows?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`
  );
});

projectsRouter.post('/projects/:id/tables/:table/rows', async (req: AuthedRequest, res) => {
  const table = encodeURIComponent(req.params.table);
  await proxyToAgent(
    req, res, 'POST',
    `/agent/projects/${req.params.id}/tables/${table}/rows`,
    req.body
  );
});

projectsRouter.patch('/projects/:id/tables/:table/rows/:pk', async (req: AuthedRequest, res) => {
  const table = encodeURIComponent(req.params.table);
  const pk = encodeURIComponent(req.params.pk);
  await proxyToAgent(
    req, res, 'PATCH',
    `/agent/projects/${req.params.id}/tables/${table}/rows/${pk}`,
    req.body
  );
});

projectsRouter.delete('/projects/:id/tables/:table/rows/:pk', async (req: AuthedRequest, res) => {
  const table = encodeURIComponent(req.params.table);
  const pk = encodeURIComponent(req.params.pk);
  await proxyToAgent(
    req, res, 'DELETE',
    `/agent/projects/${req.params.id}/tables/${table}/rows/${pk}`
  );
});
