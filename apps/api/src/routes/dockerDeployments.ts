import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { generateSubdomain } from '../lib/subdomain';
import { selectNodeForDeployment } from '../lib/nodeSelector';
import { logger } from '../lib/logger';

import { encryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import { callNodeAgent, buildAndRun } from '../lib/nodeAgentClient';

export const dockerDeploymentsRouter = Router();

dockerDeploymentsRouter.use(requireAuth);

const deployImageSchema = z.object({
  image: z.string().min(1, 'Docker image name is required'),
  preferredName: z.string().min(1, 'Name is required'),
  internalPort: z.number().default(80),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl']).default('ssl_with_proxy'),
  cpuLimit: z.number().optional(),
  memoryLimit: z.number().optional(),
});

const deployComposeSchema = z.object({
  composeYaml: z.string().min(1, 'Docker Compose YAML content is required'),
  preferredName: z.string().min(1, 'Name is required'),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
});

/**
 * POST /api/deployments/docker-image
 * Deploys an arbitrary Docker image from public/private Docker Registry.
 */
dockerDeploymentsRouter.post('/deployments/docker-image', async (req: AuthedRequest, res) => {
  try {
    const parseResult = deployImageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }

    const { image, preferredName, internalPort, envVars, nodeId: requestedNodeId, exposureMode, cpuLimit, memoryLimit } = parseResult.data;
    const userId = req.user!.id;

    if (req.user!.role !== 'admin' && req.user!.role !== 'dev') {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId, status: 'active', currentPeriodEnd: { gte: new Date() } },
      });
      if (!activeSub) {
        return res.status(403).json({ error: 'An active hosting subscription is required to deploy Docker containers.' });
      }
    }

    // Node selection
    let selectedNode;
    if (requestedNodeId) {
      selectedNode = await prisma.node.findUnique({ where: { id: requestedNodeId } });
    }
    if (!selectedNode) {
      selectedNode = await selectNodeForDeployment({ requiredTag: 'node-hosting' }).catch(() => prisma.node.findFirst({ where: { isActive: true } }));
    }
    if (!selectedNode) {
      return res.status(503).json({ error: 'No active compute nodes available' });
    }

    const subdomain = await generateSubdomain(preferredName);
    const envVarsEncrypted = envVars ? encryptSecret(JSON.stringify(envVars), env.secretsEncryptionKey) : null;

    const deployment = await prisma.deployment.create({
      data: {
        userId,
        nodeId: selectedNode.id,
        subdomain,
        internalPort,
        status: 'building',
        runtime: 'docker',
        sourceType: 'image',
        repoUrl: `image://${image}`,
        exposureMode,
        cpuLimit: cpuLimit ?? null,
        memoryLimit: memoryLimit ?? null,
        envVarsEncrypted,
      } as any,
      include: { node: true },
    });

    // Run container via node-agent
    const result = await callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`, 'POST', {
      image,
      deploymentId: deployment.id,
      subdomain,
      internalPort,
      envVars: envVars || {},
      exposureMode,
      cpuLimit,
      memLimitMb: memoryLimit,
    }).catch(async (err) => {
      logger.warn({ err, deploymentId: deployment.id }, 'run-image node-agent endpoint failed, trying buildAndRun fallback');
      return buildAndRun(selectedNode, {
        deploymentId: deployment.id,
        repoUrl: `image://${image}`,
        subdomain,
        internalPort,
        envVars,
        exposureMode,
      }, () => {});
    });

    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'running',
        containerId: result.containerId || `deploy-${deployment.id}`,
        lastDeployAt: new Date(),
      },
    });

    logger.info({ deploymentId: updated.id, image, node: selectedNode.label }, 'Docker image container deployed successfully');
    res.status(201).json({ message: 'Docker image deployed successfully', deployment: updated });
  } catch (err: any) {
    logger.error({ err }, 'Docker image deployment failed');
    res.status(500).json({ error: err.message || 'Docker image deployment failed' });
  }
});

/**
 * POST /api/deployments/docker-compose
 * Deploys an arbitrary Docker Compose stack from custom YAML content.
 */
dockerDeploymentsRouter.post('/deployments/docker-compose', async (req: AuthedRequest, res) => {
  try {
    const parseResult = deployComposeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }

    const { composeYaml, preferredName, envVars, nodeId: requestedNodeId } = parseResult.data;
    const userId = req.user!.id;

    if (req.user!.role !== 'admin' && req.user!.role !== 'dev') {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId, status: 'active', currentPeriodEnd: { gte: new Date() } },
      });
      if (!activeSub) {
        return res.status(403).json({ error: 'An active hosting subscription is required to deploy Docker Compose stacks.' });
      }
    }

    // Validate composeYaml to prevent host root mounts and privileged mode
    if (/privileged\s*:\s*true/i.test(composeYaml) || /volumes\s*:\s*.*\/:(?!\/)/i.test(composeYaml) || /network_mode\s*:\s*["']?host["']?/i.test(composeYaml)) {
      return res.status(400).json({ error: 'Privileged containers, host networking, and root host mounts are forbidden.' });
    }

    let selectedNode;
    if (requestedNodeId) {
      selectedNode = await prisma.node.findUnique({ where: { id: requestedNodeId } });
    }
    if (!selectedNode) {
      selectedNode = await selectNodeForDeployment({ requiredTag: 'node-hosting' }).catch(() => prisma.node.findFirst({ where: { isActive: true } }));
    }
    if (!selectedNode) {
      return res.status(503).json({ error: 'No active compute nodes available' });
    }

    const subdomain = await generateSubdomain(preferredName);
    const envVarsEncrypted = envVars ? encryptSecret(JSON.stringify(envVars), env.secretsEncryptionKey) : null;

    const deployment = await prisma.deployment.create({
      data: {
        userId,
        nodeId: selectedNode.id,
        subdomain,
        internalPort: 80,
        status: 'building',
        runtime: 'compose',
        sourceType: 'template',
        repoUrl: `compose://${preferredName}`,
        exposureMode: 'ssl_with_proxy',
        envVarsEncrypted,
      } as any,
      include: { node: true },
    });

    const composeResult = await callNodeAgent(selectedNode, '/agent/compose/up', 'POST', {
      projectName: `proj-${deployment.id}`,
      deploymentId: deployment.id,
      composeYaml,
      envVars: envVars || {},
    });

    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'running',
        containerId: composeResult.containerId || `compose-${deployment.id}`,
        lastDeployAt: new Date(),
      },
    });

    logger.info({ deploymentId: updated.id, name: preferredName, node: selectedNode.label }, 'Docker Compose stack deployed successfully');
    res.status(201).json({ message: 'Docker Compose stack deployed successfully', deployment: updated });
  } catch (err: any) {
    logger.error({ err }, 'Docker Compose deployment failed');
    res.status(500).json({ error: err.message || 'Docker Compose deployment failed' });
  }
});


