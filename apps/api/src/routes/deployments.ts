import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { deployService } from '../lib/deployPipeline';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import { fetchLogs, stopDeployment, cancelBuild, stopComposeProject, startDeployment, restartDeployment, buildAndRun, addCustomDomainRoute, removeCustomDomainRoute, getResourceUsage, ResourceMetrics } from '../lib/nodeAgentClient';
import { parsePagination } from '../lib/pagination';
import { verifyCnameTarget } from '../lib/customDomain';
import { createSubdomainRecord, deleteSubdomainRecord } from '../lib/cloudflare';
import { createCnameViaCloudflare, deleteCnameViaCloudflare } from '../lib/cloudflareDns';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { deleteShadowRepo } from '../lib/shadowBackup';
import { env } from '../env';
import { validateCustomSubdomain } from '../lib/subdomain';
import { getProvider } from '../lib/gitProviders';
import { logger } from '../lib/logger';
import { redactRepoUrl } from '../lib/redact';

import { scanTextForAbuse, banUserAndTeardownResources } from '../lib/abuseDetector';

export const deploymentsRouter = Router();

deploymentsRouter.use(requireAuth);

function getDecryptedEnvVars(deployment: any): Record<string, string> | undefined {
  if (!deployment.envVarsEncrypted) return undefined;
  try {
    const json = decryptSecret(deployment.envVarsEncrypted, env.secretsEncryptionKey);
    return JSON.parse(json);
  } catch (err) {
    logger.error({ deploymentId: deployment.id, err }, 'Failed to decrypt deployment envVars');
    return undefined;
  }
}

const createDeploymentSchema = z.object({
  serviceType: z.enum([
    'web_hosting',
    'node_hosting',
    'python_hosting',
    'discordbot_python',
    'discordbot_node',
    'whatsapp_baileys',
    'lavalink',
    'n8n',
    'livekit',
    'wordpress',
    'supabase_stack',
    'custom_docker',
  ]),
  templateId: z.string().optional(),
  repoUrl: z.string().url().optional(),
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).optional(),
  gitProvider: z.enum(['github', 'gitlab', 'custom']).optional(),
  gitAccountId: z.string().optional(),
  gitToken: z.string().optional(),
  preferredName: z.string().min(1),
  customSubdomain: z.string().min(2).max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens')
    .refine((val) => /[a-z]/.test(val), { message: 'Subdomain must contain at least one simple lowercase letter (a-z)' })
    .optional(),
  internalPort: z.number().int().positive().optional(),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
  isAdminDeployment: z.boolean().optional(),
  cpuLimit: z.number().min(0.1).max(16).optional(),
  memoryLimit: z.number().int().min(64).max(32768).optional(),
  storageLimit: z.number().int().min(1).max(500).optional(),
  startCommand: z.string().max(500).optional(),
  entryFile: z.string().max(255).optional(),
  frameworkPreset: z.enum(['auto', 'nextjs', 'react_vite', 'nodejs_bot', 'whatsapp_baileys', 'python_bot', 'lavalink_java', 'static_html', 'custom']).optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'internal_only', 'raw_tcp']).optional(),
  publishedPort: z.number().int().min(1).max(65535).optional(),
  teamId: z.string().nullable().optional(),
  isPendingConfig: z.boolean().optional(),
  status: z.enum(['pending', 'pending_configuration']).optional(),
  rootDir: z.string().max(255).optional().nullable(),
  watchPaths: z.array(z.string()).optional().default([]),
}).refine((data) => data.templateId || data.isPendingConfig || (data.repoUrl && data.internalPort), {
  message: 'Either templateId, isPendingConfig, or both repoUrl and internalPort are required',
});

deploymentsRouter.post('/deployments', async (req: AuthedRequest, res) => {
  const parsed = createDeploymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let data = parsed.data;

  // Automated Abuse Detection on deployment parameters (startCommand, envVars, repoUrl)
  const envText = data.envVars ? Object.entries(data.envVars).map(([k, v]) => `${k}=${v}`).join('\n') : '';
  const scanContent = `${data.repoUrl || ''}\n${data.startCommand || ''}\n${envText}`;
  const abuseResult = scanTextForAbuse(scanContent);
  if (abuseResult.flagged) {
    await banUserAndTeardownResources({
      userId: req.user!.id,
      reason: `Automated Scan: ${abuseResult.reason}`,
      detectedBy: 'Deployment Content Abuse Scanner',
    });
    return res.status(403).json({
      error: 'Account Banned for Policy Violation',
      message: `Deployment blocked and account suspended: ${abuseResult.reason}`,
      isBanned: true,
    });
  }

  if (data.repoUrl && data.gitAccountId && (data.gitProvider === 'github' || data.gitProvider === 'gitlab')) {
    const adapter = getProvider(data.gitProvider);
    if (!adapter) {
      return res.status(400).json({ error: `Git provider "${data.gitProvider}" is not available` });
    }
    const accounts = await adapter.listConnectedAccounts(req.user!.id);
    const owned = accounts.find((a) => a.id === data.gitAccountId);
    if (!owned) {
      return res.status(403).json({ error: 'That connected Git account does not belong to you' });
    }
    data.gitToken = await adapter.getScopedToken(data.gitAccountId, data.repoUrl);
  }

  // Format repoUrl with private git token if provided
  if (data.repoUrl && data.gitToken) {
    try {
      const urlObj = new URL(data.repoUrl);
      if (data.gitProvider === 'github' || urlObj.hostname.includes('github.com')) {
        data.repoUrl = `https://x-access-token:${data.gitToken}@${urlObj.hostname}${urlObj.pathname}`;
      } else if (data.gitProvider === 'gitlab' || urlObj.hostname.includes('gitlab.com')) {
        data.repoUrl = `https://oauth2:${data.gitToken}@${urlObj.hostname}${urlObj.pathname}`;
      } else {
        data.repoUrl = `https://${encodeURIComponent(data.gitToken)}@${urlObj.hostname}${urlObj.pathname}`;
      }
    } catch {
      // Keep original repoUrl if invalid URL object
    }
  }

  if (data.templateId) {
    const template = await prisma.deploymentTemplate.findUnique({ where: { id: data.templateId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    data = {
      ...data,
      repoUrl: data.repoUrl ?? template.repoUrl,
      branch: data.branch ?? template.branch,
      internalPort: data.internalPort ?? template.internalPort,
      envVars: { ...(template.defaultEnvVars as Record<string, string> | null), ...data.envVars },
    };
  }

  if (!data.repoUrl || !data.internalPort) {
    return res.status(400).json({ error: 'repoUrl and internalPort could not be resolved' });
  }

  const callerIsAdmin = req.user!.role === 'admin';
  const callerIsDev = req.user!.role === 'dev';
  const callerIsAdminOrDev = callerIsAdmin || callerIsDev;
  const effectiveIsAdminDeployment = callerIsAdmin && Boolean(data.isAdminDeployment);
  const effectiveNodeId = effectiveIsAdminDeployment ? data.nodeId : undefined;

  // Resource limits can only be set by admin/dev users
  if ((data.cpuLimit || data.memoryLimit || data.storageLimit) && !callerIsAdminOrDev) {
    return res.status(403).json({ error: 'Resource limits can only be set by admin or dev users' });
  }

  // If creating a deployment in pending configuration state (e.g. Vercel-style draft creation)
  if (data.isPendingConfig || data.status === 'pending_configuration') {
    let node;
    try {
      node = await selectNodeForDeployment({
        requiredTag: 'node-hosting',
        isAdminDeployment: effectiveIsAdminDeployment,
        explicitNodeId: effectiveNodeId,
      });
    } catch (err: any) {
      return res.status(409).json({ error: err.message || 'No available compute node for deployment' });
    }

    const subPrefix = (data.preferredName || 'app').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const subUnique = (await import('crypto')).randomBytes(3).toString('hex');
    const subdomain = data.customSubdomain || `${subPrefix}-${subUnique}`;

    // Enforce max 3 platform-issued subdomains per compute node for regular customers
    if (!callerIsAdminOrDev) {
      const existingSubdomainsOnNode = await prisma.deployment.count({
        where: {
          nodeId: node.id,
          userId: req.user!.id,
          subdomain: { not: null },
          status: { not: 'deleted' },
        },
      });
      if (existingSubdomainsOnNode >= 3) {
        return res.status(403).json({
          error: 'Platform subdomain limit reached',
          message: 'Maximum limit of 3 platform-issued subdomains per server node reached. You can attach custom domains to your existing deployments without limit.',
        });
      }
    }

    let envVarsEncrypted: string | undefined;
    if (data.envVars) {
      envVarsEncrypted = encryptSecret(JSON.stringify(data.envVars), env.secretsEncryptionKey);
    }

    const dep = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        nodeId: node.id,
        repoUrl: data.repoUrl || null,
        branch: data.branch || 'main',
        subdomain,
        internalPort: data.internalPort || 3000,
        status: 'pending_configuration',
        startCommand: data.startCommand || null,
        entryFile: data.entryFile || null,
        frameworkPreset: data.frameworkPreset || 'auto',
        exposureMode: data.exposureMode || 'ssl_with_proxy',
        cpuLimit: data.cpuLimit || null,
        memoryLimit: data.memoryLimit || null,
        storageLimit: data.storageLimit || null,
        envVarsEncrypted: envVarsEncrypted || null,
        webHostingType: data.serviceType,
      },
    });

    return res.status(201).json({
      ok: true,
      deployment: { ...dep, repoUrl: redactRepoUrl(dep.repoUrl) },
    });
  }

  if (!data.repoUrl || !data.internalPort) {
    return res.status(400).json({ error: 'repoUrl and internalPort could not be resolved' });
  }

  // Build progress is streamed back as newline-delimited JSON so the client
  // dashboard can show live build logs instead of a blank spinner.
  res.setHeader('Content-Type', 'application/x-ndjson');

  try {
    const { deployment, subdomain } = await deployService({
      userId: req.user!.id,
      serviceType: data.serviceType,
      repoUrl: data.repoUrl!,
      branch: data.branch,
      preferredName: data.preferredName,
      customSubdomain: data.customSubdomain,
      internalPort: data.internalPort!,
      envVars: data.envVars,
      isAdminDeployment: effectiveIsAdminDeployment,
      explicitNodeId: effectiveNodeId,
      templateId: data.templateId,
      cpuLimit: data.cpuLimit,
      memoryLimit: data.memoryLimit,
      storageLimit: data.storageLimit,
      startCommand: data.startCommand,
      entryFile: data.entryFile,
      frameworkPreset: data.frameworkPreset,
      exposureMode: data.exposureMode,
      publishedPort: data.publishedPort,
      onEvent: (event) => res.write(JSON.stringify(event) + '\n'),
    });

    res.write(JSON.stringify({ phase: 'complete', deploymentId: deployment.id, subdomain }) + '\n');
    res.end();
  } catch (err) {
    const message = err instanceof NodeSelectionError ? err.message : 'Deployment failed';
    res.write(JSON.stringify({ phase: 'error', message }) + '\n');
    res.end();
  }
});

deploymentsRouter.post('/deployments/:id/launch', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const repoUrl = req.body.repoUrl || deployment.repoUrl;
  const internalPort = req.body.internalPort || deployment.internalPort || 3000;

  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required to launch deployment' });
  }

  let envVarsEncrypted = deployment.envVarsEncrypted;
  if (req.body.envVars) {
    envVarsEncrypted = encryptSecret(JSON.stringify(req.body.envVars), env.secretsEncryptionKey);
  }

  const updatedDeployment = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      repoUrl,
      branch: req.body.branch || deployment.branch || 'main',
      startCommand: req.body.startCommand !== undefined ? req.body.startCommand : deployment.startCommand,
      entryFile: req.body.entryFile !== undefined ? req.body.entryFile : deployment.entryFile,
      frameworkPreset: req.body.frameworkPreset !== undefined ? req.body.frameworkPreset : deployment.frameworkPreset,
      internalPort,
      exposureMode: req.body.exposureMode !== undefined ? req.body.exposureMode : deployment.exposureMode,
      subdomain: req.body.subdomain !== undefined ? req.body.subdomain : deployment.subdomain,
      envVarsEncrypted,
      status: 'building',
    },
  });

  res.setHeader('Content-Type', 'application/x-ndjson');

  try {
    const isPublic = updatedDeployment.exposureMode !== 'internal_only';
    if (isPublic && updatedDeployment.subdomain) {
      const isProxied = updatedDeployment.exposureMode === 'ssl_with_proxy';
      await createSubdomainRecord(updatedDeployment.subdomain, deployment.node.ip, isProxied).catch((err) => {
        logger.warn({ err, subdomain: updatedDeployment.subdomain }, 'Cloudflare DNS record setup warning');
      });
    }

    const envVars = req.body.envVars || getDecryptedEnvVars(updatedDeployment);

    const result = await buildAndRun(
      deployment.node,
      {
        deploymentId: updatedDeployment.id,
        repoUrl,
        branch: updatedDeployment.branch || 'main',
        subdomain: updatedDeployment.subdomain || undefined,
        internalPort,
        envVars,
        cpuLimit: updatedDeployment.cpuLimit || undefined,
        memoryLimit: updatedDeployment.memoryLimit || undefined,
        storageLimit: updatedDeployment.storageLimit || undefined,
        startCommand: updatedDeployment.startCommand || undefined,
        entryFile: updatedDeployment.entryFile || undefined,
        frameworkPreset: updatedDeployment.frameworkPreset || undefined,
        exposureMode: updatedDeployment.exposureMode || undefined,
      },
      (event) => res.write(JSON.stringify(event) + '\n')
    );

    if (result.phase === 'error') {
      await prisma.deployment.update({
        where: { id: updatedDeployment.id },
        data: { status: 'failed' },
      });
      res.write(JSON.stringify({ phase: 'error', message: result.message || 'Deployment launch failed' }) + '\n');
      return res.end();
    }

    await prisma.deployment.update({
      where: { id: updatedDeployment.id },
      data: {
        status: 'running',
        containerId: result.containerId,
        lastDeployAt: new Date(),
      },
    });

    res.write(JSON.stringify({ phase: 'complete', deploymentId: updatedDeployment.id, subdomain: updatedDeployment.subdomain }) + '\n');
    res.end();
  } catch (err: any) {
    await prisma.deployment.update({
      where: { id: updatedDeployment.id },
      data: { status: 'failed' },
    });
    res.write(JSON.stringify({ phase: 'error', message: err?.message || 'Deployment launch failed' }) + '\n');
    res.end();
  }
});


deploymentsRouter.get('/deployments', async (req: AuthedRequest, res) => {
  // Admin scoped to assigned customers' deployments.
  const where = await ownedResourceWhere(req);
  const { take, skip } = parsePagination(req.query);

  const [deployments, total] = await Promise.all([
    prisma.deployment.findMany({
      where,
      include: { node: { select: { label: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.deployment.count({ where }),
  ]);

  res.json({
    deployments: deployments.map((d) => ({ ...d, repoUrl: redactRepoUrl(d.repoUrl) })),
    total,
    take,
    skip,
  });
});

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });

  if (!deployment) return null;
  // Dev unrestricted; admin only for an assigned customer's deployment.
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

deploymentsRouter.get('/deployments/:id/logs', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.containerId) return res.json({ logs: '' });

  try {
    const logs = await fetchLogs(deployment.node, deployment.containerId);
    res.json({ logs });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch logs from node' });
  }
});

/**
 * GET /api/deployments/:id/logs/stream
 * Streams real-time logs from a deployment using Server-Sent Events (SSE).
 * 
 * Requirements:
 * - Stream container stdout and stderr to API clients
 * - Display timestamps with each log line
 * - RBAC: deployment owner or admin/dev can stream logs
 * 
 * The endpoint proxies the SSE stream from the node-agent to the client,
 * handling connection cleanup when the client disconnects.
 */
deploymentsRouter.get('/deployments/:id/logs/stream', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  if (!deployment.containerId) {
    // No container means nothing to stream
    res.write('data: {"type":"error","message":"No container running for this deployment"}\n\n');
    return res.end();
  }

  // Build the node-agent stream URL

  // Build the node-agent stream URL
  const streamUrl = `http://${deployment.node.ip}:${env.nodeAgentPort}/agent/deployments/${deployment.containerId}/logs/stream`;
  
  try {
    // Fetch the stream from node-agent
    const nodeResponse = await fetch(streamUrl, {
      headers: {
        'x-agent-secret': env.nodeAgentSecret,
      },
    });

    if (!nodeResponse.ok) {
      res.write(`data: ${JSON.stringify({type:"error",message:"Failed to connect to log stream"})}\n\n`);
      return res.end();
    }

    if (!nodeResponse.body) {
      res.write(`data: ${JSON.stringify({type:"error",message:"No stream body from node"})}\n\n`);
      return res.end();
    }

    // Pipe the stream from node-agent to client
    const reader = nodeResponse.body.getReader();
    const decoder = new TextDecoder();

    const streamLogs = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Forward the SSE data directly to the client
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
        res.end();
      } catch (err) {
        logger.error({ deploymentId: deployment.id, err }, 'Error streaming logs from node');
        res.end();
      }
    };

    // Start streaming
    streamLogs();

    // Handle client disconnect
    req.on('close', () => {
      logger.info({ deploymentId: deployment.id }, 'Client disconnected from log stream');
      reader.cancel();
      res.end();
    });

  } catch (err) {
    logger.error({ deploymentId: deployment.id, err }, 'Failed to establish log stream');
    res.write(`data: ${JSON.stringify({type:"error",message:"Failed to establish log stream"})}\n\n`);
    res.end();
  }
});

deploymentsRouter.patch('/deployments/:id/routing', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const schema = z.object({
    routingMode: z.enum(['proxied', 'direct', 'no_ssl']),
    publishedPort: z.number().optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid routing data', details: parse.error.format() });
  }

  // Update in database / memory
  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      subdomain: parse.data.routingMode === 'direct' ? null : deployment.subdomain,
    },
  });

  logger.info({ deploymentId: deployment.id, routingMode: parse.data.routingMode }, 'Updated routing mode');
  res.json({ deployment: { ...updated, repoUrl: redactRepoUrl(updated.repoUrl) }, routingMode: parse.data.routingMode, publishedPort: parse.data.publishedPort || deployment.internalPort });
});


deploymentsRouter.get('/deployments/:id', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  // Fetch resource usage metrics if deployment is running with a container
  let resourceUsage: ResourceMetrics | null = null;
  if (deployment.status === 'running' && deployment.containerId) {
    try {
      resourceUsage = await getResourceUsage(deployment.node, deployment.containerId);
    } catch (err) {
      // Log error but don't fail the entire request if metrics fetch fails
      logger.warn({ deploymentId: deployment.id, err }, 'Failed to fetch resource usage metrics');
      // Return null for resourceUsage when metrics cannot be fetched
      resourceUsage = null;
    }
  }

  // Decrypt environment variables if present
  let envVars: Record<string, string> | null = null;
  if (deployment.envVarsEncrypted) {
    try {
      const decrypted = decryptSecret(deployment.envVarsEncrypted, env.secretsEncryptionKey);
      envVars = JSON.parse(decrypted);
    } catch (err) {
      logger.warn({ deploymentId: deployment.id, err }, 'Failed to decrypt environment variables');
      envVars = null;
    }
  }

  res.json({
    deployment: {
      id: deployment.id,
      userId: deployment.userId,
      nodeId: deployment.nodeId,
      repoUrl: redactRepoUrl(deployment.repoUrl),
      branch: deployment.branch,
      subdomain: deployment.subdomain,
      internalPort: deployment.internalPort,
      status: deployment.status,
      cpuLimit: deployment.cpuLimit,
      memoryLimit: deployment.memoryLimit,
      storageLimit: deployment.storageLimit,
      createdAt: deployment.createdAt,
      lastDeployAt: deployment.lastDeployAt,
      gitCommitHash: deployment.gitCommitHash,
      gitCommitMessage: deployment.gitCommitMessage,
      autoDeploy: deployment.autoDeploy,
      hasGitToken: Boolean(deployment.githubTokenEncrypted),
    },
    envVars,
    resourceUsage,
  });
});

const updateConfigSchema = z.object({
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  frameworkPreset: z.string().optional(),
  startCommand: z.string().optional(),
  entryFile: z.string().max(255).optional(),
  internalPort: z.number().int().positive().optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'raw_tcp', 'internal_only']).optional(),
  subdomain: z.string().optional(),
  envVars: z.record(z.string()).optional(),
  rootDir: z.string().max(255).optional().nullable(),
  watchPaths: z.array(z.string()).optional(),
});

deploymentsRouter.patch('/deployments/:id/config', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = updateConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { repoUrl, branch, frameworkPreset, startCommand, entryFile, internalPort, exposureMode, subdomain, envVars, rootDir, watchPaths } = parsed.data;

  if (subdomain !== undefined && subdomain.trim()) {
    const check = await validateCustomSubdomain(subdomain, deployment.id);
    if (!check.valid || !check.formatted) {
      return res.status(400).json({ error: check.error ?? 'Invalid custom subdomain' });
    }
  }

  let envVarsEncrypted = deployment.envVarsEncrypted;
  if (envVars) {
    envVarsEncrypted = encryptSecret(JSON.stringify(envVars), env.secretsEncryptionKey);
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      repoUrl: repoUrl !== undefined ? repoUrl : deployment.repoUrl,
      branch: branch !== undefined ? branch : deployment.branch,
      frameworkPreset: frameworkPreset !== undefined ? frameworkPreset : deployment.frameworkPreset,
      startCommand: startCommand !== undefined ? startCommand : deployment.startCommand,
      entryFile: entryFile !== undefined ? entryFile : deployment.entryFile,
      internalPort: internalPort !== undefined ? internalPort : deployment.internalPort,
      exposureMode: exposureMode !== undefined ? exposureMode : deployment.exposureMode,
      subdomain: subdomain !== undefined ? subdomain : deployment.subdomain,
      rootDir: rootDir !== undefined ? rootDir : deployment.rootDir,
      watchPaths: watchPaths !== undefined ? watchPaths : deployment.watchPaths,
      envVarsEncrypted,
    },
  });

  res.json({
    ok: true,
    deployment: { ...updated, repoUrl: redactRepoUrl(updated.repoUrl) },
  });
});

deploymentsRouter.post('/deployments/:id/stop', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.containerId) return res.status(409).json({ error: 'Nothing running' });

  try {
    await stopDeployment(deployment.node, deployment.containerId);
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'stopped' },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Failed to stop deployment on node' });
  }
});

deploymentsRouter.post('/deployments/:id/start', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.containerId) return res.status(409).json({ error: 'No container to start' });
  if (deployment.status === 'running') return res.status(409).json({ error: 'Deployment is already running' });

  try {
    await startDeployment(deployment.node, deployment.containerId);
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running' },
    });
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'failed' },
    });
    res.status(502).json({ error: 'Failed to start deployment on node. The container may have been removed — please redeploy.' });
  }
});


deploymentsRouter.delete('/deployments/:id', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  try {
    const isCompose = deployment.repoUrl?.startsWith('template:') || false;
    if (isCompose) {
      const projectName = deployment.containerId || deployment.subdomain;
      if (projectName) {
        await stopComposeProject(deployment.node, projectName).catch((err) => {
          logger.warn({ err, deploymentId: deployment.id }, 'Failed to stop compose project on node (continuing deletion)');
        });
      }
    } else if (deployment.containerId) {
      await stopDeployment(deployment.node, deployment.containerId).catch((err) => {
        logger.warn({ err, deploymentId: deployment.id }, 'Failed to stop container on node (continuing deletion)');
      });
    }

    // Teardown shadow backup repo if non-Git deployment
    void deleteShadowRepo(deployment.id);

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'deleted' },
    });
    res.json({ ok: true, message: 'Deployment deleted successfully' });
  } catch (err: any) {
    logger.error({ err, deploymentId: req.params.id }, 'Failed to delete deployment');
    res.status(500).json({ error: err.message || 'Failed to delete deployment' });
  }
});

deploymentsRouter.post('/deployments/:id/restart', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.containerId) return res.status(409).json({ error: 'No container to restart' });
  if (deployment.status !== 'running') return res.status(409).json({ error: 'Deployment must be running to restart' });

  try {
    await restartDeployment(deployment.node, deployment.containerId);
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running' },
    });
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    res.status(502).json({ error: 'Failed to restart deployment on node' });
  }
});

const attachDomainSchema = z.object({
  domain: z.string().min(3),
  // Optional: if the customer's domain is also on Cloudflare and they're
  // willing to provide a scoped API token (Zone:DNS Edit on just this
  // zone), the CNAME is created automatically instead of asking them to
  // add it manually at their registrar. Neither value is stored — used
  // once here, then discarded.
  cloudflareApiToken: z.string().optional(),
  cloudflareZoneId: z.string().optional(),
});

/**
 * Step 1 of attaching a custom domain: records it as pending and tells the
 * customer exactly what CNAME to create — or, if they provided Cloudflare
 * credentials for their own zone, creates it for them automatically. Either
 * way, Traefik isn't touched yet — that only happens after verify confirms
 * the CNAME actually resolves, which for the manual path gives DNS time to
 * propagate and for the automated path is just a sanity check.
 */
deploymentsRouter.post('/deployments/:id/custom-domain', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.subdomain) {
    return res.status(409).json({ error: 'This deployment has no public subdomain to point a custom domain at' });
  }

  const parsed = attachDomainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const cnameTarget = `${deployment.subdomain}.${env.deploymentsRootDomain}`;
  let cloudflareRecordId: string | null = null;

  if (parsed.data.cloudflareApiToken && parsed.data.cloudflareZoneId) {
    try {
      const result = await createCnameViaCloudflare({
        apiToken: parsed.data.cloudflareApiToken,
        zoneId: parsed.data.cloudflareZoneId,
        domain: parsed.data.domain,
        target: cnameTarget,
      });
      cloudflareRecordId = result.recordId;
    } catch (err) {
      return res.status(502).json({
        error: `Failed to create the DNS record via Cloudflare: ${(err as Error).message}. You can still add the CNAME manually instead.`,
      });
    }
  }

  try {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        customDomain: parsed.data.domain,
        customDomainStatus: 'pending',
        customDomainCloudflareRecordId: cloudflareRecordId,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This domain is already attached to another deployment' });
    }
    throw err;
  }

  res.json({
    customDomain: parsed.data.domain,
    instructions: cloudflareRecordId
      ? 'DNS record created automatically via Cloudflare — verify once it propagates (usually within a minute).'
      : `Add a CNAME record: ${parsed.data.domain} -> ${cnameTarget}`,
    cnameTarget,
    autoCreated: Boolean(cloudflareRecordId),
  });
});

/** Step 2: checks the CNAME actually resolves correctly, then wires up the route on the node. */
deploymentsRouter.post('/deployments/:id/custom-domain/verify', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.customDomain || !deployment.internalPort) {
    return res.status(409).json({ error: 'No custom domain pending verification for this deployment' });
  }

  const cnameTarget = `${deployment.subdomain}.${env.deploymentsRootDomain}`;
  const result = await verifyCnameTarget(deployment.customDomain, cnameTarget);

  if (!result.verified) {
    await prisma.deployment.update({ where: { id: deployment.id }, data: { customDomainStatus: 'failed' } });
    return res.status(409).json({ verified: false, reason: result.reason });
  }

  try {
    await addCustomDomainRoute(
      deployment.node,
      deployment.id,
      deployment.customDomain,
      deployment.internalPort,
      env.deploymentsRootDomain
    );
  } catch (err) {
    return res.status(502).json({ error: 'DNS verified, but failed to wire up routing on the node. Try again shortly.' });
  }

  await prisma.deployment.update({ where: { id: deployment.id }, data: { customDomainStatus: 'verified' } });
  res.json({ verified: true, domain: deployment.customDomain });
});

const removeDomainQuerySchema = z.object({
  cloudflareApiToken: z.string().optional(),
  cloudflareZoneId: z.string().optional(),
});

/**
 * Neither the Cloudflare API token nor zone ID are persisted (by design —
 * see the attach endpoint's comment), so cleaning up an auto-created
 * record requires the customer to supply the token again here. If they
 * don't, the Traefik route and our own DB record are still removed; the
 * customer just needs to delete the leftover CNAME at Cloudflare
 * themselves, same as if they'd created it manually in the first place.
 */
deploymentsRouter.delete('/deployments/:id/custom-domain', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.customDomain) return res.status(404).json({ error: 'No custom domain attached' });

  const parsed = removeDomainQuerySchema.safeParse(req.body ?? {});
  const { cloudflareApiToken, cloudflareZoneId } = parsed.success ? parsed.data : {};

  if (deployment.customDomainStatus === 'verified') {
    try {
      await removeCustomDomainRoute(deployment.node, deployment.id, deployment.customDomain);
    } catch (err) {
      logger.warn({ deploymentId: deployment.id, err }, 'Failed to remove custom domain route on node (continuing anyway)');
    }
  }

  let cloudflareCleanupWarning: string | undefined;
  if (deployment.customDomainCloudflareRecordId && cloudflareApiToken && cloudflareZoneId) {
    try {
      await deleteCnameViaCloudflare({
        apiToken: cloudflareApiToken,
        zoneId: cloudflareZoneId,
        recordId: deployment.customDomainCloudflareRecordId,
      });
    } catch (err) {
      cloudflareCleanupWarning = `Removed here, but failed to delete the Cloudflare DNS record: ${(err as Error).message}`;
    }
  } else if (deployment.customDomainCloudflareRecordId) {
    cloudflareCleanupWarning =
      'This domain was auto-created via Cloudflare — the leftover CNAME record needs manual deletion at Cloudflare, or resubmit this request with cloudflareApiToken/cloudflareZoneId.';
  }

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { customDomain: null, customDomainStatus: 'none', customDomainCloudflareRecordId: null },
  });

  res.json({ ok: true, warning: cloudflareCleanupWarning });
});

const updateSubdomainSchema = z.object({
  subdomain: z.string().min(2).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
});

/**
 * Updates a deployment's primary subdomain under ROOT_DOMAIN.
 * Validates availability, creates new Cloudflare DNS record, and restarts container with new Traefik labels.
 */
deploymentsRouter.patch('/deployments/:id/subdomain', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  if (req.user?.role !== 'admin' && req.user?.role !== 'dev') {
    return res.status(403).json({
      error: 'Subdomains can only be set once during application creation and cannot be modified later by customers.',
    });
  }

  const parsed = updateSubdomainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const validation = await validateCustomSubdomain(parsed.data.subdomain, deployment.id);
  if (!validation.valid || !validation.formatted) {
    return res.status(409).json({ error: validation.error ?? 'Invalid subdomain' });
  }

  const oldSubdomain = deployment.subdomain;
  const newSubdomain = validation.formatted;

  // Point Cloudflare DNS to node IP for the new subdomain and clean up old DNS
  try {
    await createSubdomainRecord(newSubdomain, deployment.node.ip);
    if (oldSubdomain && oldSubdomain !== newSubdomain) {
      void deleteSubdomainRecord(oldSubdomain);
    }
  } catch (err) {
    logger.warn({ deploymentId: deployment.id, err }, 'Failed to create Cloudflare DNS record for new subdomain');
  }

  try {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { subdomain: newSubdomain },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'This subdomain is already taken. Please choose another.' });
    }
    throw err;
  }

  // Re-apply container Traefik labels on node if running
  if (deployment.status === 'running' && deployment.containerId && deployment.repoUrl && deployment.internalPort) {
    try {
      await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: deployment.repoUrl,
          subdomain: newSubdomain,
          internalPort: deployment.internalPort,
          envVars: getDecryptedEnvVars(deployment),
          backupRepoUrl: deployment.backupRepoFullName ?? undefined,
        },
        () => {}
      );
    } catch (err) {
      logger.error({ deploymentId: deployment.id, err }, 'Failed to apply new subdomain labels on container');
    }
  }

  res.json({ ok: true, subdomain: newSubdomain, url: `https://${newSubdomain}.${env.deploymentsRootDomain}` });
});


/**
 * Rebuilds an EXISTING deployment in place — same node, same subdomain, no
 * new DNS record. Until this existed, the only options were "create a
 * brand-new deployment" (new subdomain every time, pointless for pushing
 * an update) or "stop" with no way back except starting over.
 */
deploymentsRouter.post('/deployments/:id/redeploy', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.repoUrl || !deployment.internalPort) {
    return res.status(409).json({ error: 'This deployment has no repo/port to rebuild from' });
  }

  const redeploySchema = z.object({ branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).optional() });
  const parsed = redeploySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  res.setHeader('Content-Type', 'application/x-ndjson');
  await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'building' } });

  try {
    const result = await buildAndRun(
      deployment.node,
      {
        deploymentId: deployment.id,
        repoUrl: deployment.repoUrl,
        branch: parsed.data.branch,
        subdomain: deployment.subdomain ?? undefined,
        internalPort: deployment.internalPort,
        envVars: getDecryptedEnvVars(deployment),
        backupRepoUrl: deployment.backupRepoFullName ?? undefined,
      },
      (event) => res.write(JSON.stringify(event) + '\n')
    );

    if (result.phase === 'error') {
      await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } });
      res.write(JSON.stringify({ phase: 'error', message: result.message }) + '\n');
      return res.end();
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running', containerId: result.containerId, lastDeployAt: new Date() },
    });

    res.write(JSON.stringify({ phase: 'complete', deploymentId: deployment.id }) + '\n');
    res.end();
  } catch (err) {
    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } });
    res.write(JSON.stringify({ phase: 'error', message: 'Redeploy failed' }) + '\n');
    res.end();
  }
});

deploymentsRouter.post('/deployments/:id/cancel-build', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  try {
    await cancelBuild(deployment.node, deployment.id).catch((err) => {
      logger.warn({ deploymentId: deployment.id, err }, 'Failed to trigger cancel-build on node (continuing local update)');
    });
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'failed' },
    });
    res.json({ ok: true, message: 'Build cancelled successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel build' });
  }
});


const createPreviewSchema = z.object({
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).min(1),
  serviceType: z
    .enum(['web_hosting', 'node_hosting', 'python_hosting', 'discordbot_python', 'discordbot_node'])
    .optional(),
});

/**
 * Creates a lightweight second environment tied to a git branch, linked
 * back to this "parent" deployment — same node-selection and build
 * pipeline as a normal deployment, just tagged isPreview + parentDeploymentId
 * so the dashboard can group it and so it's excluded by default from
 * uptime monitoring (see lib/uptimeMonitor.ts). Previews get their own
 * subdomain but can never have a custom domain attached.
 *
 * serviceType isn't stored on Deployment today, so it can't be perfectly
 * inferred from the parent — defaults to 'node_hosting' for public parents
 * (subdomain set) or 'discordbot_node' otherwise; override explicitly if
 * that guess is wrong for a given parent.
 */
deploymentsRouter.post('/deployments/:id/preview', async (req: AuthedRequest, res) => {
  const parent = await loadOwnedDeployment(req, req.params.id);
  if (!parent) return res.status(404).json({ error: 'Deployment not found' });
  if (!parent.repoUrl || !parent.internalPort) {
    return res.status(409).json({ error: 'This deployment has no repo/port to branch a preview from' });
  }

  const parsed = createPreviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const inferredServiceType = parsed.data.serviceType ?? (parent.subdomain ? 'node_hosting' : 'discordbot_node');

  res.setHeader('Content-Type', 'application/x-ndjson');

  try {
    const { deployment, subdomain } = await deployService({
      userId: req.user!.id,
      serviceType: inferredServiceType,
      repoUrl: parent.repoUrl,
      branch: parsed.data.branch,
      preferredName: `${parent.subdomain ?? 'preview'}-${parsed.data.branch}`.slice(0, 40),
      internalPort: parent.internalPort,
      isPreview: true,
      parentDeploymentId: parent.id,
      onEvent: (event) => res.write(JSON.stringify(event) + '\n'),
    });

    res.write(JSON.stringify({ phase: 'complete', deploymentId: deployment.id, subdomain }) + '\n');
    res.end();
  } catch (err) {
    res.write(JSON.stringify({ phase: 'error', message: 'Preview deployment failed' }) + '\n');
    res.end();
  }
});

const updateResourceLimitsSchema = z.object({
  cpuLimit: z.number().min(0.1).max(16).optional(),      // CPU cores: 0.1-16
  memoryLimit: z.number().int().min(64).max(32768).optional(), // Memory MB: 64-32GB
  storageLimit: z.number().int().min(1).max(500).optional(),   // Storage GB: 1-500GB
}).refine((data) => data.cpuLimit !== undefined || data.memoryLimit !== undefined || data.storageLimit !== undefined, {
  message: 'At least one resource limit must be provided',
});

/**
 * Updates resource limits for an existing deployment and restarts it to
 * apply the new limits. Only admin/dev users can update
 * resource limits. The deployment is restarted automatically to ensure the
 * new limits are enforced by Docker.
 */
deploymentsRouter.patch('/deployments/:id/limits', async (req: AuthedRequest, res) => {
  // Only admin/dev can update resource limits
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only admin or dev users can update resource limits' });
  }

  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = updateResourceLimitsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Update resource limits in database
  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      cpuLimit: parsed.data.cpuLimit ?? deployment.cpuLimit,
      memoryLimit: parsed.data.memoryLimit ?? deployment.memoryLimit,
      storageLimit: parsed.data.storageLimit ?? deployment.storageLimit,
    },
  });

  // Restart deployment to apply new limits if the deployment is currently running
  if (deployment.status === 'running' && deployment.containerId && deployment.repoUrl && deployment.internalPort) {
    res.setHeader('Content-Type', 'application/x-ndjson');
    
    try {
      const result = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: deployment.repoUrl,
          branch: deployment.branch ?? undefined,
          subdomain: deployment.subdomain ?? undefined,
          internalPort: deployment.internalPort,
          cpuLimit: updated.cpuLimit ?? undefined,
          memoryLimit: updated.memoryLimit ?? undefined,
          storageLimit: updated.storageLimit ?? undefined,
          envVars: getDecryptedEnvVars(deployment),
          backupRepoUrl: deployment.backupRepoFullName ?? undefined,
        },
        (event) => res.write(JSON.stringify(event) + '\n')
      );

      if (result.phase === 'error') {
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'failed' },
        });
        res.write(JSON.stringify({ phase: 'error', message: 'Failed to restart with new limits' }) + '\n');
        return res.end();
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { containerId: result.containerId, lastDeployAt: new Date() },
      });

      res.write(JSON.stringify({ 
        phase: 'complete', 
        deploymentId: deployment.id,
        limits: {
          cpuLimit: updated.cpuLimit,
          memoryLimit: updated.memoryLimit,
          storageLimit: updated.storageLimit,
        }
      }) + '\n');
      res.end();
    } catch (err) {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'failed' },
      });
      res.write(JSON.stringify({ phase: 'error', message: 'Failed to restart deployment with new limits' }) + '\n');
      res.end();
    }
  } else {
    // Deployment not running - just return updated limits without restart
    res.json({
      ok: true,
      deployment: {
        id: updated.id,
        cpuLimit: updated.cpuLimit,
        memoryLimit: updated.memoryLimit,
        storageLimit: updated.storageLimit,
      },
      message: 'Resource limits updated. Changes will apply on next deployment start.',
    });
  }
});


const updateEnvVarsSchema = z.object({
  envVars: z.record(z.string()),
  mode: z.enum(['merge', 'replace']).optional().default('merge'),
});

/**
 * Updates environment variables for an existing deployment and restarts it to
 * apply the changes (Requirements 12.10-12.11). Environment variables are
 * encrypted before storage and decrypted when needed for deployment operations.
 * 
 * RBAC: Deployment owner (customer) or admin/dev can update environment variables.
 * 
 * Flow:
 * 1. Verify access permissions (owner, admin, or dev)
 * 2. Validate input schema (envVars record)
 * 3. Encrypt envVars using secretsVault AES-256-GCM
 * 4. Return updated deployment with success confirmation
 */
/**
 * GET /api/deployments/:id/env
 * Fetches decrypted environment variables for a deployment.
 */
deploymentsRouter.get('/deployments/:id/env', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const envVars = getDecryptedEnvVars(deployment) || {};
  res.json({ envVars });
});

deploymentsRouter.patch('/deployments/:id/env', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = updateEnvVarsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const currentEnvVars = getDecryptedEnvVars(deployment) || {};
  const finalEnvVars = parsed.data.mode === 'replace'
    ? parsed.data.envVars
    : { ...currentEnvVars, ...parsed.data.envVars };

  // Encrypt the new environment variables
  const envVarsEncrypted = encryptSecret(
    JSON.stringify(finalEnvVars),
    env.secretsEncryptionKey
  );

  // Update environment variables in database
  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: { envVarsEncrypted },
  });

  // Restart deployment to apply new environment variables
  // Only restart if the deployment is currently running and has the necessary fields
  if (deployment.status === 'running' && deployment.containerId && deployment.repoUrl && deployment.internalPort) {
    res.setHeader('Content-Type', 'application/x-ndjson');
    
    try {
      // Stop the current container first
      await stopDeployment(deployment.node, deployment.containerId);
      
      // Rebuild and run with new environment variables
      const result = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: deployment.repoUrl,
          branch: deployment.branch ?? undefined,
          subdomain: deployment.subdomain ?? undefined,
          internalPort: deployment.internalPort,
          envVars: parsed.data.envVars, // Pass the new environment variables
          cpuLimit: deployment.cpuLimit ?? undefined,
          memoryLimit: deployment.memoryLimit ?? undefined,
          storageLimit: deployment.storageLimit ?? undefined,
          backupRepoUrl: deployment.backupRepoFullName ?? undefined,
        },
        (event) => res.write(JSON.stringify(event) + '\n')
      );

      if (result.phase === 'error') {
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'failed' },
        });
        res.write(JSON.stringify({ 
          phase: 'error', 
          message: 'Failed to restart deployment with new environment variables' 
        }) + '\n');
        return res.end();
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { 
          status: 'running',
          containerId: result.containerId, 
          lastDeployAt: new Date() 
        },
      });

      res.write(JSON.stringify({ 
        phase: 'complete', 
        deploymentId: deployment.id,
        message: 'Environment variables updated and deployment restarted successfully'
      }) + '\n');
      res.end();
    } catch (err) {
      logger.error({ deploymentId: deployment.id, err }, 'Failed to restart deployment with new env vars');
      res.write(JSON.stringify({ 
        phase: 'error', 
        message: 'Failed to restart deployment with new environment variables' 
      }) + '\n');
      res.end();
    }
  } else {
    // Deployment not running - just return success without restart
    res.json({
      ok: true,
      deployment: {
        id: updated.id,
        envVarsUpdated: true,
      },
      message: 'Environment variables updated. Changes will apply on next deployment start.',
    });
  }
});

const updateGitSettingsSchema = z.object({
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).optional(),
  gitToken: z.string().optional(),
  autoDeploy: z.boolean().optional(),
});

/**
 * PATCH /api/deployments/:id/git-settings
 * Updates Git repository configuration: tracked branch, private access token, and auto-deploy on push toggle.
 */
deploymentsRouter.patch('/deployments/:id/git-settings', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = updateGitSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const dataToUpdate: Record<string, any> = {};
  if (parsed.data.branch !== undefined) dataToUpdate.branch = parsed.data.branch;
  if (parsed.data.autoDeploy !== undefined) dataToUpdate.autoDeploy = parsed.data.autoDeploy;
  if (parsed.data.gitToken !== undefined) {
    dataToUpdate.githubTokenEncrypted = parsed.data.gitToken
      ? encryptSecret(parsed.data.gitToken, env.secretsEncryptionKey)
      : null;
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: dataToUpdate,
  });

  res.json({
    ok: true,
    branch: updated.branch,
    autoDeploy: updated.autoDeploy,
    hasGitToken: Boolean(updated.githubTokenEncrypted),
  });
});

const botHostingSchema = z.object({
  language: z.enum(['python', 'nodejs']),
  preferredName: z.string().min(1),
  repoUrl: z.string().url().optional(),
  branch: z.string().optional().default('main'),
  entryFile: z.string().optional(),
  startCommand: z.string().optional(),
  envVars: z.record(z.string()).optional(),
  isPendingConfig: z.boolean().optional(),
});

/**
 * POST /api/deployments/bot-hosting
 * Guided bot hosting endpoint with first-class language selector (Python vs Node.js).
 */
deploymentsRouter.post('/deployments/bot-hosting', async (req: AuthedRequest, res) => {
  const parsed = botHostingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { language, preferredName, repoUrl, branch, entryFile, startCommand, envVars, isPendingConfig } = parsed.data;

  const serviceType = language === 'python' ? 'discordbot_python' : 'discordbot_node';
  const frameworkPreset = language === 'python' ? 'python_bot' : 'nodejs_bot';
  const defaultEntry = entryFile || (language === 'python' ? 'bot.py' : 'index.js');
  const defaultStart = startCommand || (language === 'python' ? `python ${defaultEntry}` : `node ${defaultEntry}`);

  let node;
  try {
    node = await selectNodeForDeployment({
      requiredTag: 'node-hosting',
      isAdminDeployment: false,
    });
  } catch (err: any) {
    return res.status(409).json({ error: err.message || 'No available compute node for bot deployment' });
  }

  let envVarsEncrypted: string | undefined;
  if (envVars) {
    envVarsEncrypted = encryptSecret(JSON.stringify(envVars), env.secretsEncryptionKey);
  }

  const dep = await prisma.deployment.create({
    data: {
      userId: req.user!.id,
      nodeId: node.id,
      repoUrl: repoUrl || null,
      branch,
      subdomain: null, // Bots do not consume public subdomains
      internalPort: 3000,
      status: isPendingConfig ? 'pending_configuration' : 'pending',
      startCommand: defaultStart,
      entryFile: defaultEntry,
      frameworkPreset,
      exposureMode: 'no_ssl',
      envVarsEncrypted: envVarsEncrypted || null,
      webHostingType: serviceType,
    },
  });

  res.status(201).json({
    ok: true,
    botDeployment: { ...dep, repoUrl: redactRepoUrl(dep.repoUrl) },
    language,
    entryFile: defaultEntry,
    startCommand: defaultStart,
  });
});
