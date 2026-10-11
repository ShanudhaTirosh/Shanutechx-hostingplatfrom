import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { generateLiveKitKeyPair, createRoomAccessToken } from '../lib/livekit';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import { registerLiveKitKey } from '../lib/nodeAgentClient';
import { logger } from '../lib/logger';

export const livekitRouter = Router();

livekitRouter.use(requireAuth);

const createProjectSchema = z.object({
  userId: z.string(),
  orderItemId: z.string().optional(),
  nodeId: z.string().optional(), // admin override only, same rule as deployments
});

/**
 * Provisions a new LiveKit project. Self-hosted LiveKit authenticates
 * against a static key/secret list in its own config — there's no dynamic
 * "create API key" endpoint on LiveKit's side, so this generates the
 * key/secret pair here, then asks the node-agent on the assigned node to
 * write it into LiveKit's config and restart the container so it actually
 * takes effect.
 */
livekitRouter.post('/livekit/projects', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { userId, orderItemId, nodeId } = parsed.data;

  let node;
  try {
    node = await selectNodeForDeployment({
      requiredTag: 'livekit',
      isAdminDeployment: true,
      explicitNodeId: nodeId,
    });
  } catch (err) {
    if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
    throw err;
  }

  const { apiKey, apiSecret } = generateLiveKitKeyPair();
  const apiSecretRef = encryptSecret(apiSecret, env.secretsEncryptionKey);

  const project = await prisma.liveKitProject.create({
    data: { userId, orderItemId, apiKey, apiSecretRef, nodeId: node.id },
  });

  let nodeRegistered = true;
  try {
    await registerLiveKitKey(node, { apiKey, apiSecret });
  } catch (err) {
    nodeRegistered = false;
    logger.error({ projectId: project.id, err }, 'Failed to register LiveKit key on node');
  }

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'livekit.create_project', target: project.id },
  });

  res.status(201).json({
    project: { ...project, apiSecretRef: undefined },
    nodeRegistered,
    warning: nodeRegistered
      ? undefined
      : 'Project was saved but the LiveKit server on the node could not be updated — tokens will not work until this is retried.',
  });
});

livekitRouter.get('/livekit/projects', async (req: AuthedRequest, res) => {
  // Admin scoped to assigned customers' projects.
  const baseWhere = await ownedResourceWhere(req);
  const where = { ...baseWhere, isActive: true };
  const projects = await prisma.liveKitProject.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({
    projects: projects.map((p: (typeof projects)[number]) => ({ ...p, apiSecretRef: undefined })),
  });
});

const tokenSchema = z.object({
  roomName: z.string().min(1),
  identity: z.string().min(1),
});

livekitRouter.post('/livekit/projects/:id/token', async (req: AuthedRequest, res) => {
  const project = await prisma.liveKitProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.isActive) {
    return res.status(403).json({ error: 'Cannot generate tokens for a deactivated LiveKit project' });
  }
  if (!(await canAccessResource(project.userId, req))) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const apiSecret = decryptSecret(project.apiSecretRef, env.secretsEncryptionKey);
    const token = await createRoomAccessToken({
      apiKey: project.apiKey,
      apiSecret,
      roomName: parsed.data.roomName,
      identity: parsed.data.identity,
    });
    res.json({ token });
  } catch (err: any) {
    logger.error({ projectId: project.id, err }, 'Failed to create LiveKit room token');
    res.status(500).json({ error: 'Failed to generate room token' });
  }
});

/**
 * DELETE /api/livekit/projects/:id
 * Deprovision a LiveKit project record
 */
livekitRouter.delete('/livekit/projects/:id', async (req: AuthedRequest, res) => {
  const project = await prisma.liveKitProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!(await canAccessResource(project.userId, req))) {
    return res.status(404).json({ error: 'Project not found' });
  }

  await prisma.liveKitProject.update({
    where: { id: project.id },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'livekit.delete_project', target: project.id },
  });

  res.json({ ok: true, deletedId: project.id });
});
