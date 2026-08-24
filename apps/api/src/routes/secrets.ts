import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import { logger } from '../lib/logger';

/**
 * Secrets Vault API endpoints (AES-256-GCM encrypted storage).
 */

export const secretsRouter = Router();

async function logAudit(projectId: string, action: string, actorId: string, secretKey?: string) {
  await prisma.secretAuditEntry.create({
    data: { projectId, action, actorId, secretKey },
  }).catch((err: any) => logger.error({ err, projectId, action }, 'Failed to write secrets audit entry'));
}

function decryptItem(item: { id: string; key: string; valueEnc: string; comment: string | null; updatedAt: Date }) {
  return {
    id: item.id,
    key: item.key,
    value: decryptSecret(item.valueEnc, env.secretsEncryptionKey),
    comment: item.comment ?? undefined,
    updatedAt: item.updatedAt.toISOString(),
  };
}

// 1. List Projects
secretsRouter.get('/secrets/projects', requireAuth, requireAdminOrDev, async (_req: AuthedRequest, res: Response) => {
  const projects = await prisma.secretProject.findMany({
    include: { _count: { select: { secrets: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    projects: projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      environment: p.environment,
      secretCount: p._count.secrets,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

const createProjectSchema = z.object({
  name: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

// 2. Create Project
secretsRouter.post('/secrets/projects', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Project name is required' });

  const project = await prisma.secretProject.create({
    data: { name: parsed.data.name, environment: parsed.data.environment },
  });

  await logAudit(project.id, 'CREATE', req.user!.id);

  res.json({
    project: {
      id: project.id,
      name: project.name,
      environment: project.environment,
      secrets: [],
      createdAt: project.createdAt.toISOString(),
    },
  });
});

// 3. Get Project Secrets
secretsRouter.get('/secrets/projects/:id', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const project = await prisma.secretProject.findUnique({ where: { id }, include: { secrets: true } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  await logAudit(id, 'READ', req.user!.id);

  res.json({
    project: {
      id: project.id,
      name: project.name,
      environment: project.environment,
      createdAt: project.createdAt.toISOString(),
      secrets: project.secrets.map(decryptItem),
    },
  });
});

const upsertSecretSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  comment: z.string().optional(),
});

// 4. Add or Update Single Secret
secretsRouter.post('/secrets/projects/:id/secrets', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const parsed = upsertSecretSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Key and value are required' });

  const project = await prisma.secretProject.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { key, value, comment } = parsed.data;
  const valueEnc = encryptSecret(value, env.secretsEncryptionKey);
  const existing = await prisma.secretItem.findUnique({ where: { projectId_key: { projectId: id, key } } });

  await prisma.secretItem.upsert({
    where: { projectId_key: { projectId: id, key } },
    create: { projectId: id, key, valueEnc, comment },
    update: { valueEnc, ...(comment !== undefined ? { comment } : {}) },
  });

  await logAudit(id, existing ? 'UPDATE' : 'CREATE', req.user!.id, key);

  const secrets = await prisma.secretItem.findMany({ where: { projectId: id } });
  res.json({
    project: {
      id: project.id,
      name: project.name,
      environment: project.environment,
      createdAt: project.createdAt.toISOString(),
      secrets: secrets.map(decryptItem),
    },
  });
});

const bulkImportSchema = z.object({
  items: z.array(z.object({ key: z.string().min(1), value: z.string(), comment: z.string().optional() })).min(1),
});

// 5. Bulk Import Secrets Array Endpoint
secretsRouter.post('/secrets/projects/:id/bulk-secrets', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Items array is required for bulk import' });

  const project = await prisma.secretProject.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  let countAdded = 0;
  let countUpdated = 0;

  for (const item of parsed.data.items) {
    const existing = await prisma.secretItem.findUnique({ where: { projectId_key: { projectId: id, key: item.key } } });
    const valueEnc = encryptSecret(item.value, env.secretsEncryptionKey);
    await prisma.secretItem.upsert({
      where: { projectId_key: { projectId: id, key: item.key } },
      create: { projectId: id, key: item.key, valueEnc, comment: item.comment },
      update: { valueEnc, ...(item.comment !== undefined ? { comment: item.comment } : {}) },
    });
    if (existing) countUpdated++;
    else countAdded++;
  }

  await logAudit(id, 'IMPORT', req.user!.id);

  const secrets = await prisma.secretItem.findMany({ where: { projectId: id } });
  res.json({
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      environment: project.environment,
      createdAt: project.createdAt.toISOString(),
      secrets: secrets.map(decryptItem),
    },
    countAdded,
    countUpdated,
    total: secrets.length,
  });
});

// 6. Delete Secret
secretsRouter.delete('/secrets/projects/:id/secrets/:key', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const key = decodeURIComponent(req.params.key);

  const project = await prisma.secretProject.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  await prisma.secretItem.deleteMany({ where: { projectId: id, key } });
  await logAudit(id, 'DELETE', req.user!.id, key);

  res.json({ ok: true, deletedKey: key });
});

// 7. Audit Trail
secretsRouter.get('/secrets/audit', requireAuth, requireAdminOrDev, async (_req: AuthedRequest, res: Response) => {
  const entries = await prisma.secretAuditEntry.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { name: true } }, actor: { select: { email: true } } },
  });

  res.json({
    auditLogs: entries.map((e: any) => ({
      id: e.id,
      projectId: e.projectId,
      projectName: e.project?.name ?? 'Deleted Project',
      action: e.action,
      actorEmail: e.actor?.email ?? 'System/Deleted',
      timestamp: e.createdAt.toISOString(),
    })),
  });
});
