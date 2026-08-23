import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { deployService } from '../lib/deployPipeline';
import { NodeSelectionError } from '../lib/nodeSelector';
import { fetchLogs, stopDeployment, startDeployment, restartDeployment, buildAndRun, addCustomDomainRoute, removeCustomDomainRoute, getResourceUsage, ResourceMetrics } from '../lib/nodeAgentClient';
import { parsePagination } from '../lib/pagination';
import { verifyCnameTarget } from '../lib/customDomain';
import { createSubdomainRecord } from '../lib/cloudflare';
import { createCnameViaCloudflare, deleteCnameViaCloudflare } from '../lib/cloudflareDns';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { deleteShadowRepo } from '../lib/shadowBackup';
import { env } from '../env';
import { validateCustomSubdomain } from '../lib/subdomain';
import { getProvider } from '../lib/gitProviders';
import { logger } from '../lib/logger';

export const deploymentsRouter = Router();

deploymentsRouter.use(requireAuth);

const createDeploymentSchema = z.object({
  serviceType: z.enum([
    'web_hosting',
    'node_hosting',
    'python_hosting',
    'discordbot_python',
    'discordbot_node',
    'n8n',
    'livekit',
    'lavalink',
    'wordpress',
    'supabase_stack',
    'custom_docker',
  ]),
  templateId: z.string().optional(),
  repoUrl: z.string().url().optional(),
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid branch name').max(100).optional(),
  gitProvider: z.enum(['github', 'gitlab', 'custom']).optional(),
  // Audit findings H7/H10 rewrite: gitAccountId (a connected GitHub App
  // installation / GitLab OAuth connection) is now the primary way to
  // supply credentials for a private github.com/gitlab.com repo -- no
  // PAT is requested from or stored for the user. `gitToken` is kept only
  // for `gitProvider: 'custom'` (e.g. a self-hosted Gitea/Bitbucket
  // instance), which isn't covered by the GitHub/GitLab App integrations
  // and legitimately has no other way to authenticate.
  gitAccountId: z.string().optional(),
  gitToken: z.string().optional(),
  preferredName: z.string().min(1),
  customSubdomain: z.string().min(2).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens').optional(),
  internalPort: z.number().int().positive().optional(),
  envVars: z.record(z.string()).optional(),
  nodeId: z.string().optional(),
  isAdminDeployment: z.boolean().optional(),
  cpuLimit: z.number().min(0.1).max(16).optional(),
  memoryLimit: z.number().int().min(64).max(32768).optional(),
  storageLimit: z.number().int().min(1).max(500).optional(),
}).refine((data) => data.templateId || (data.repoUrl && data.internalPort), {
  message: 'Either templateId, or both repoUrl and internalPort, are required',
});

deploymentsRouter.post('/deployments', async (req: AuthedRequest, res) => {
  const parsed = createDeploymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let data = parsed.data;

  // Audit findings H7/H10 rewrite: resolve a connected GitHub App
  // installation / GitLab OAuth connection into a short-lived, narrowly-
  // scoped token server-side, rather than requiring the frontend to have
  // ever held a long-lived PAT. `gitToken` remains supported only for
  // `gitProvider: 'custom'` git hosts, which have no App/OAuth
  // integration here.
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

  // Resource limits can only be set by admin/dev users (Requirement 17)
  if ((data.cpuLimit || data.memoryLimit || data.storageLimit) && !callerIsAdminOrDev) {
    return res.status(403).json({ error: 'Resource limits can only be set by admin or dev users' });
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

deploymentsRouter.get('/deployments', async (req: AuthedRequest, res) => {
  // Phase 15: admin scoped to assigned customers' deployments. Also fixes
  // a pre-existing bug where dev fell into the customer-only branch here
  // (only 'admin' was special-cased) and would have seen just their own.
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

  res.json({ deployments, total, take, skip });
});

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });

  if (!deployment) return null;
  // Phase 15: dev unrestricted; admin only for an assigned customer's
  // deployment (was: unconditional bypass for admin, same as dev).
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
 * - Requirement 19.4: Support log streaming for real-time log viewing
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
  if (!deployment.containerId) {
    // No container means nothing to stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('data: {"type":"error","message":"No container running for this deployment"}\n\n');
    return res.end();
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

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
  res.json({ deployment: updated, routingMode: parse.data.routingMode, publishedPort: parse.data.publishedPort || deployment.internalPort });
});


deploymentsRouter.get('/deployments/:id', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  // Fetch resource usage metrics if deployment is running with a container
  // (Requirement 17.7: Display resource usage metrics)
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

  // Decrypt environment variables if present (Requirement 12.4)
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
      repoUrl: deployment.repoUrl,
      subdomain: deployment.subdomain,
      internalPort: deployment.internalPort,
      status: deployment.status,
      cpuLimit: deployment.cpuLimit,
      memoryLimit: deployment.memoryLimit,
      storageLimit: deployment.storageLimit,
      createdAt: deployment.createdAt,
      lastDeployAt: deployment.lastDeployAt,
    },
    envVars,
    resourceUsage,
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
    res.status(502).json({ error: 'Failed to start deployment on node' });
  }
});

deploymentsRouter.delete('/deployments/:id', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  try {
    if (deployment.containerId) {
      await stopDeployment(deployment.node, deployment.containerId).catch(() => {});
    }

    // Teardown shadow backup repo if non-Git deployment
    void deleteShadowRepo(deployment.id);

    await prisma.deployment.delete({ where: { id: deployment.id } });
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

  const cnameTarget = `${deployment.subdomain}.${env.rootDomain}`;
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

  const cnameTarget = `${deployment.subdomain}.${env.rootDomain}`;
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
      env.rootDomain
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

  const parsed = updateSubdomainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const validation = await validateCustomSubdomain(parsed.data.subdomain, deployment.id);
  if (!validation.valid || !validation.formatted) {
    return res.status(409).json({ error: validation.error ?? 'Invalid subdomain' });
  }

  const newSubdomain = validation.formatted;

  // Point Cloudflare DNS to node IP for the new subdomain
  try {
    await createSubdomainRecord(newSubdomain, deployment.node.ip);
  } catch (err) {
    logger.warn({ deploymentId: deployment.id, err }, 'Failed to create Cloudflare DNS record for new subdomain');
  }

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { subdomain: newSubdomain },
  });

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
        },
        () => {}
      );
    } catch (err) {
      logger.error({ deploymentId: deployment.id, err }, 'Failed to apply new subdomain labels on container');
    }
  }

  res.json({ ok: true, subdomain: newSubdomain, url: `https://${newSubdomain}.${env.rootDomain}` });
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
 * apply the new limits (Requirement 17). Only admin/dev users can update
 * resource limits. The deployment is restarted automatically to ensure the
 * new limits are enforced by Docker.
 */
deploymentsRouter.patch('/deployments/:id/limits', async (req: AuthedRequest, res) => {
  // Only admin/dev can update resource limits (Requirement 17 RBAC)
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
        },
        (event) => res.write(JSON.stringify(event) + '\n')
      );

      if (result.phase === 'error') {
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
  envVars: z.record(z.string()).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one environment variable must be provided',
  }),
});

/**
 * Updates environment variables for an existing deployment and restarts it to
 * apply the changes (Requirements 12.10-12.11). Environment variables are
 * encrypted before storage and decrypted when needed for deployment operations.
 * 
 * RBAC: Deployment owner (customer) or admin/dev can update environment variables.
 * 
 * Process:
 * 1. Validate request and check ownership
 * 2. Encrypt and store new environment variables in database
 * 3. Restart deployment to apply new environment variables
 * 4. Return updated deployment with success confirmation
 */
deploymentsRouter.patch('/deployments/:id/env', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = updateEnvVarsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Encrypt the new environment variables (Requirement 12.10)
  const envVarsEncrypted = encryptSecret(
    JSON.stringify(parsed.data.envVars),
    env.secretsEncryptionKey
  );

  // Update environment variables in database
  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: { envVarsEncrypted },
  });

  // Restart deployment to apply new environment variables (Requirement 12.11)
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
