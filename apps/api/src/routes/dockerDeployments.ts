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
import { claimDeploymentSlot } from '../lib/deploymentSlots';
import { autoDetectExposureMode } from '../lib/exposureDefaults';
import { createSubdomainRecord } from '../lib/cloudflare';
import { validateComposeSecurity } from '../lib/composeIsolation';

import { useForOwnRoutes } from '../lib/routerGuard';
export const dockerDeploymentsRouter = Router();

useForOwnRoutes(dockerDeploymentsRouter, requireAuth);

const deployImageSchema = z.object({
  image: z.string().min(1, 'Docker image name is required'),
  preferredName: z.string().min(1, 'Name is required'),
  internalPort: z.number().default(80),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'raw_tcp', 'internal_only', 'auto']).optional(),
  cpuLimit: z.number().optional(),
  memoryLimit: z.number().optional(),
  orderItemId: z.string().optional(),
});

const deployComposeSchema = z.object({
  composeYaml: z.string().min(1, 'Docker Compose YAML content is required'),
  preferredName: z.string().min(1, 'Name is required'),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
  orderItemId: z.string().optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'raw_tcp', 'internal_only', 'auto']).optional(),
  configFiles: z.record(z.string()).optional(),
  configFileContent: z.string().optional(),
  configFileName: z.string().optional(),
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

    const callerIsAdminOrDev = req.user!.role === 'admin' || req.user!.role === 'dev';
    let claimedOrderItemId: string | null = null;
    try {
      const slot = await claimDeploymentSlot(userId, {
        preferredOrderItemId: req.body.orderItemId,
        isAdminOrDev: callerIsAdminOrDev,
      });
      claimedOrderItemId = slot.orderItemId;
    } catch (slotErr: any) {
      return res.status(slotErr.statusCode || 403).json({ error: slotErr.message });
    }

    const effectiveExposureMode = autoDetectExposureMode({
      explicitMode: exposureMode,
      port: internalPort,
      image,
    });

    const deployment = await prisma.deployment.create({
      data: {
        userId,
        orderItemId: claimedOrderItemId,
        nodeId: selectedNode.id,
        subdomain,
        internalPort,
        status: 'building',
        runtime: 'docker',
        sourceType: 'image',
        repoUrl: `image://${image}`,
        exposureMode: effectiveExposureMode,
        cpuLimit: cpuLimit ?? null,
        memoryLimit: memoryLimit ?? null,
        envVarsEncrypted,
      } as any,
      include: { node: true },
    });

    // Load any configured persistent volumes for this deployment
    const dbVolumes = await prisma.deploymentVolume.findMany({
      where: { deploymentId: deployment.id },
    });
    const volumes = dbVolumes.map((v) => ({
      hostPath: v.hostPath,
      containerPath: v.containerPath,
      mode: 'rw' as const,
    }));

    // Run container via node-agent
    let result: any;
    try {
      result = await callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`, 'POST', {
        image,
        deploymentId: deployment.id,
        subdomain,
        internalPort,
        envVars: envVars || {},
        volumes,
        exposureMode: effectiveExposureMode,
        cpuLimit,
        memLimitMb: memoryLimit,
      });
    } catch (err: any) {
      logger.error({ err, deploymentId: deployment.id }, 'run-image node-agent endpoint failed');
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'failed' },
      });
      return res.status(502).json({ error: `Image deployment failed: ${err.message}` });
    }

    if (effectiveExposureMode !== 'internal_only' && subdomain && selectedNode.ip) {
      try {
        await createSubdomainRecord(subdomain, selectedNode.ip, true);
        logger.info({ subdomain, ip: selectedNode.ip }, 'Auto-registered Cloudflare SSL proxy DNS record for docker image deployment');
      } catch (dnsErr) {
        logger.warn({ dnsErr, subdomain }, 'Cloudflare DNS auto-record registration skipped or failed');
      }
    }

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

    const { composeYaml, preferredName, envVars, nodeId: requestedNodeId, exposureMode, configFiles, configFileContent, configFileName } = parseResult.data;
    const userId = req.user!.id;

    if (req.user!.role !== 'admin' && req.user!.role !== 'dev') {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId, status: 'active', currentPeriodEnd: { gte: new Date() } },
      });
      if (!activeSub) {
        return res.status(403).json({ error: 'An active hosting subscription is required to deploy Docker Compose stacks.' });
      }
    }

    // Validate composeYaml for multi-tenant security and host isolation
    const isolationCheck = validateComposeSecurity(composeYaml);
    if (!isolationCheck.valid) {
      return res.status(400).json({ error: isolationCheck.error || 'Invalid or insecure compose YAML' });
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

    const callerIsAdminOrDev = req.user!.role === 'admin' || req.user!.role === 'dev';
    let claimedOrderItemId: string | null = null;
    try {
      const slot = await claimDeploymentSlot(userId, {
        preferredOrderItemId: req.body.orderItemId,
        isAdminOrDev: callerIsAdminOrDev,
      });
      claimedOrderItemId = slot.orderItemId;
    } catch (slotErr: any) {
      return res.status(slotErr.statusCode || 403).json({ error: slotErr.message });
    }

    const effectiveExposureMode = autoDetectExposureMode({
      explicitMode: exposureMode,
      composeYaml,
    });

    const deployment = await prisma.deployment.create({
      data: {
        userId,
        orderItemId: claimedOrderItemId,
        nodeId: selectedNode.id,
        subdomain,
        internalPort: 80,
        status: 'building',
        runtime: 'compose',
        sourceType: 'template',
        repoUrl: `compose://${preferredName}`,
        exposureMode: effectiveExposureMode,
        envVarsEncrypted,
      } as any,
      include: { node: true },
    });

    const filesPayload = { ...(configFiles || {}) };
    if (configFileContent) {
      filesPayload[configFileName || 'config.yaml'] = configFileContent;
    }

    const composeResult = await callNodeAgent(selectedNode, '/agent/compose/up', 'POST', {
      projectName: `proj-${deployment.id}`,
      deploymentId: deployment.id,
      composeYaml,
      envVars: envVars || {},
      configFiles: filesPayload,
      configFileContent,
      configFileName,
    });

    if (effectiveExposureMode !== 'internal_only' && subdomain && selectedNode.ip) {
      try {
        await createSubdomainRecord(subdomain, selectedNode.ip, true);
        logger.info({ subdomain, ip: selectedNode.ip }, 'Auto-registered Cloudflare SSL proxy DNS record for docker compose deployment');
      } catch (dnsErr) {
        logger.warn({ dnsErr, subdomain }, 'Cloudflare DNS auto-record registration skipped or failed');
      }
    }

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


