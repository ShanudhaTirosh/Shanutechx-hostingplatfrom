import { prisma } from './prisma';
import { selectNodeForDeployment } from './nodeSelector';
import { generateSubdomain } from './subdomain';
import { createSubdomainRecord } from './cloudflare';
import { buildAndRun, BuildEvent } from './nodeAgentClient';
import { notifyCustomer } from './notifications';
import { fireWebhook } from './webhooks';
import { encryptSecret } from './secretsVault';
import { env } from '../env';

const SERVICE_TYPE_TO_TAG: Record<string, string> = {
  web_hosting: 'web-hosting',
  node_hosting: 'node-hosting',
  python_hosting: 'python-hosting',
  discordbot_python: 'discordbot-python',
  discordbot_node: 'discordbot-node',
};

// Discord bots have no public endpoint — no subdomain, no DNS record, no
// Traefik labels. Everything else is a public web service.
const PUBLIC_SERVICE_TYPES = new Set(['web_hosting', 'node_hosting', 'python_hosting']);

interface DeployParams {
  userId: string;
  serviceType: string;
  repoUrl: string;
  branch?: string;
  preferredName: string;
  customSubdomain?: string;
  internalPort: number;
  envVars?: Record<string, string>;
  isAdminDeployment?: boolean;
  explicitNodeId?: string;
  templateId?: string;
  isPreview?: boolean;
  parentDeploymentId?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  storageLimit?: number;
  startCommand?: string;
  entryFile?: string;
  frameworkPreset?: string;
  exposureMode?: string;
  publishedPort?: number;
  onEvent?: (event: BuildEvent) => void;
}

/**
 * End-to-end deploy: pick a node (auto for customers, optionally manual for
 * admin-only deployments — see nodeSelector.ts), reserve a subdomain if this
 * service type is public-facing, point DNS at the node, then hand off the
 * actual build to that node's agent. The Deployment row tracks status the
 * whole way so a failed step never leaves the UI showing a false "running".
 *
 * Preview deployments (isPreview=true) go through the exact same pipeline —
 * same node selection, same subdomain generation, same build — they're just
 * tagged with parentDeploymentId and isPreview so the UI can group them
 * under their production deployment and so they're excluded from anything
 * that should only apply to "real" deployments (e.g. uptime monitoring
 * defaults to skipping previews — see lib/uptimeMonitor.ts).
 */
export async function deployService(params: DeployParams) {
  const {
    userId,
    serviceType,
    repoUrl,
    branch,
    preferredName,
    internalPort,
    envVars,
    isAdminDeployment,
    explicitNodeId,
    isPreview,
    parentDeploymentId,
    cpuLimit,
    memoryLimit,
    storageLimit,
    startCommand,
    entryFile,
    frameworkPreset,
    exposureMode,
    publishedPort,
    onEvent,
  } = params;

  const node = await selectNodeForDeployment({
    requiredTag: SERVICE_TYPE_TO_TAG[serviceType] || 'web-hosting',
    isAdminDeployment,
    explicitNodeId,
  });

  const isPublic = exposureMode
    ? exposureMode !== 'internal_only'
    : PUBLIC_SERVICE_TYPES.has(serviceType);
  const subdomain = isPublic ? await generateSubdomain(preferredName, params.customSubdomain) : undefined;

  // Encrypt environment variables if provided (Requirements 12.10-12.11)
  const envVarsEncrypted = envVars
    ? encryptSecret(JSON.stringify(envVars), env.secretsEncryptionKey)
    : null;

  const deployment = await prisma.deployment.create({
    data: {
      userId,
      nodeId: node.id,
      isAdminDeployment: Boolean(isAdminDeployment),
      repoUrl,
      runtime: null,
      subdomain,
      internalPort,
      status: 'building',
      isPreview: Boolean(isPreview),
      parentDeploymentId: parentDeploymentId ?? null,
      branch: branch ?? null,
      templateId: params.templateId ?? null,
      cpuLimit: cpuLimit ?? null,
      memoryLimit: memoryLimit ?? null,
      storageLimit: storageLimit ?? null,
      envVarsEncrypted: envVarsEncrypted,
      startCommand: startCommand ?? null,
      entryFile: entryFile ?? null,
      frameworkPreset: frameworkPreset ?? 'auto',
      exposureMode: exposureMode ?? 'ssl_with_proxy',
      publishedPort: publishedPort ?? null,
    },
  });

  try {
    if (subdomain) {
      const isProxied = deployment.exposureMode === 'ssl_with_proxy';
      await createSubdomainRecord(subdomain, node.ip, isProxied);
    }

    const result = await buildAndRun(
      node,
      { 
        deploymentId: deployment.id, 
        repoUrl, 
        branch, 
        subdomain, 
        internalPort, 
        envVars,
        cpuLimit,
        memoryLimit,
        storageLimit,
        startCommand,
        entryFile,
        frameworkPreset,
        exposureMode,
        publishedPort,
      },
      (event) => onEvent?.(event)
    );

    if (result.phase === 'error') {
      // BUG-06 FIX: Simply throw the error and let the single catch block handle
      // the status update to 'failed', the webhook event, and customer notification.
      throw new Error(result.message ?? 'Deployment failed');
    }

    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'running',
        containerId: result.containerId,
        lastDeployAt: new Date(),
      },
    });

    void fireWebhook(userId, 'deployment_status_changed', {
      deploymentId: deployment.id,
      status: 'running',
      subdomain,
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const liveUrl = subdomain ? `https://${subdomain}.${env.rootDomain}` : null;
      void notifyCustomer(
        user,
        liveUrl
          ? `Your deployment is live: ${liveUrl}`
          : `Your deployment is up and running.`
      );
    }

    return { deployment: updated, node, subdomain };
  } catch (err) {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'failed' },
    });
    void fireWebhook(userId, 'deployment_status_changed', { deploymentId: deployment.id, status: 'failed' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      void notifyCustomer(
        user,
        `Your deployment failed to start. Check the build logs in your dashboard or contact support.`
      );
    }

    throw err;
  }
}
