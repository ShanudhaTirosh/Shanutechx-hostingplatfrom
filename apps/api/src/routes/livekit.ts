import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
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
  // Phase 15: admin scoped to assigned customers' projects; also fixes dev
  // previously falling into the customer-only branch here.
  const where = await ownedResourceWhere(req);
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
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && project.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const apiSecret = decryptSecret(project.apiSecretRef, env.secretsEncryptionKey);
  const token = await createRoomAccessToken({
    apiKey: project.apiKey,
    apiSecret,
    roomName: parsed.data.roomName,
    identity: parsed.data.identity,
  });

  res.json({ token });
});
